# FloodGuard — IoT Flood Monitoring & Community Alerts

FloodGuard is a civic-technology web platform for monitoring water levels from
field IoT sensors and publishing flood-severity alerts to the public, with a
secure administrator console for device and threshold management.

The system is designed around this hardware chain:

```
Water-level sensor
  → ESP32-1 (sensor node)
  → SX1278 LoRa 433 MHz (transmitter)
  → SX1278 LoRa 433 MHz (receiver)
  → ESP32-2 (gateway, ID: FG-GATEWAY-002)  [SIM800L GSM + NEO-6M GPS]
  → Authenticated backend API  (POST /api/v1/devices/readings)
  → Database  (PostgreSQL — Neon)
  → FloodGuard website (public dashboard + admin console)
```

> The repository is the source of truth. This web application integrates the
> full-stack implementation described in the project brief.

---

## Important honesty notes (read first)

These constraints are enforced in code and surfaced in the UI:

- **50-metre circles are monitoring zones, not administrative wards.** They are
  drawn around configured sensor points and must not be presented as official
  government boundaries.
- **Raw sensor values are not centimetres.** A calibrated water level is only
  shown after an administrator configures and validates a calibration
  (`slope`/`intercept`). Until then the UI shows
  *"Raw sensor reading — calibration required."*
- **Flow is never invented.** A water-level sensor alone does not measure
  L/min. Flow appears only when a real flow reading (or a validated, clearly
  labelled estimate) exists; otherwise the UI shows
  *"Flow data unavailable — additional sensor or validated model required."*
- **Demo data is labelled `SIMULATED`.** It is kept separate from real
  readings and must never be presented as actual measurements.
- **The gateway is identified by a unique ID (`FG-GATEWAY-002`), never by its
  IP address.** The latest reported IP is shown for diagnostics only.
- **Device tokens, passwords, API keys and database credentials are never
  committed** and never exposed on the public dashboard.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 3.4 |
| Map | Leaflet + react-leaflet + OpenStreetMap tiles |
| Charts | Recharts |
| ORM / DB | Prisma 6 → PostgreSQL (Neon in production; any Postgres URL locally) |
| Validation | Zod |
| Admin sessions | `jose` (HS256 signed cookie) |
| Crypto | Node `crypto` — scrypt password hashing, SHA-256 peppered device-token hashing, `timingSafeEqual` |
| Tests | Vitest (DB-free domain/validation/auth tests) |

---

## Quick start (development / demo)

Requires **Node.js ≥ 20**.

```bash
# 1. Install dependencies
npm install

# 2. Create your local environment file (never commit .env)
cp .env.example .env
#    Set DATABASE_URL to a PostgreSQL/Neon connection string, plus real
#    AUTH_SECRET and DEVICE_TOKEN_SECRET values.

# 3. Generate Prisma client, apply migrations, seed demo data
npm run setup        # = prisma generate && prisma migrate deploy && npm run db:seed

# 4. Run the site
npm run dev          # http://localhost:3000
```

The seed is optional — the dashboard renders correctly against an empty
database ("Waiting for sensor data"). When run, it creates a `FG-GATEWAY-002`
gateway, six sensors, three 50 m zones, thresholds, two demo alerts, and the
bootstrap admin. Device tokens and the gateway/sensor IDs are printed to the
console during seeding — **these are development-only values and are not
committed.**

Demo admin login (local only): `admin@example.local` / `change-me-admin-password`
(set via `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`). **Change these for any
non-local deployment.**

### Other scripts

```bash
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest (41 tests)
npm run build        # production build (runs `prisma generate` first)
npm run start        # serve the production build
npm run db:studio    # Prisma Studio (inspect the DB)
```

### Troubleshooting

**`@prisma/client did not initialize yet. Please run "prisma generate"`**
This happens on a fresh clone when the Prisma Client has not been generated.
`npm install` now runs `prisma generate` automatically (via a `postinstall`
script), and `npm run build` regenerates it too. If you still see it — for
example because your package manager blocks lifecycle scripts — run:

```bash
npx prisma generate
```

If your npm config blocks `postinstall`, approve the Prisma engine scripts
(`npm approve-scripts @prisma/engines prisma @prisma/client`) or just run
`npx prisma generate` manually before `npm run dev`.

---

## Pages

| Route | Purpose |
| --- | --- |
| `/` | **Public Dashboard** — sensor totals, online/offline/warning/critical counts, zone count, latest water levels, latest alerts, last update. |
| `/map` | **Live Flood Map** — sensor + gateway locations, 50 m monitoring-zone circles, severity markers, latest readings, auto-refresh every 15 s; lists sensors with no verified GPS as "Location unavailable". |
| `/sensors` | All sensors with current status. |
| `/sensors/[deviceId]` | **Sensor Details** — raw value, calibrated cm, flood status, flow (or the unavailable message), LoRa RSSI/SNR, battery, packet seq, location, data quality, assigned zones, and a water-level history chart. |
| `/zones` | **Monitoring Zones** — zone ID, centre, 50 m radius, assigned sensors, highest severity, last update, flow availability. |
| `/zones/[zoneId]` | A single zone's detail view. |
| `/diagnostics` | **Device Diagnostics** — `FG-GATEWAY-002` identity, online/offline, last communication, firmware, GPS fix + gateway coordinates, LoRa RSSI/SNR, battery, packets received, latest reported IP (diagnostics only). |
| `/alerts` | **Alerts** — warning/critical/offline/stale alerts with timestamps, related sensor + zone, and acknowledgement status. |
| `/admin/login` | Administrator sign-in. |
| `/admin` | **Admin Console** — register sensors/gateways, configure calibration + location, set flood thresholds, create/assign zones, review & acknowledge alerts. Server-gated: redirects to login when unauthenticated. |

---

## API

All API routes run on the Node.js runtime and are non-cached.

### Device ingestion (authenticated)

`POST /api/v1/devices/readings`

Requires `Authorization: Bearer <device_token>`. Body schema (all
optional-measurement fields may be `null`):

```json
{
  "device_id": "FG-SENSOR-001",
  "gateway_id": "FG-GATEWAY-002",
  "raw_sensor_value": 0,
  "calibrated_water_level_cm": null,
  "water_flow_lpm": null,
  "flood_status": "CALIBRATION_REQUIRED",
  "latitude": null,
  "longitude": null,
  "battery_voltage": null,
  "lora_rssi": null,
  "lora_snr": null,
  "packet_sequence": 1,
  "firmware_version": "1.0.0",
  "simulated": false
}
```

Behaviour: per-IP rate limiting → Zod `.strict()` validation (malformed or
unknown fields → `422`) → device authentication (missing/invalid token → `401`)
→ gateway resolution → duplicate-packet handling (a `packet_sequence` at or
below the device's last accepted value is rejected) → calibration &
classification → server-side reception timestamp recorded → alert escalation
only when severity increases.

### Public reads

`GET /api/v1/live` · `/summary` · `/sensors` · `/sensors/[deviceId]` ·
`/zones` · `/alerts` · `/gateways/[gatewayId]`

**CSV exports (public):** `GET /api/v1/alerts/export` (all alerts) and
`GET /api/v1/sensors/[deviceId]/history` (a sensor's stored readings) return
downloadable `.csv` files.

### Admin (cookie-session authenticated)

`POST /api/v1/admin/login` · `/logout` · `GET /session` ·
`POST /api/v1/admin/devices` (register; returns the device token **once**) ·
`PUT /api/v1/admin/devices/[deviceId]/calibration` ·
`PUT /api/v1/admin/devices/thresholds` ·
`POST /api/v1/admin/zones` · `POST /api/v1/admin/alerts/[id]/ack`

**Gateway heartbeat:** `POST /api/v1/gateways/[gatewayId]/heartbeat` (admin
session) marks a gateway online and records gateway-level telemetry (GPS,
battery, LoRa RSSI/SNR, firmware, last-reported IP) independently of any sensor
reading. The gateway is identified by its unique ID, never its IP.

Access control is enforced on the backend, not merely by hiding UI buttons.
Device registration returns the plaintext token exactly once; only its hashed
form is stored.

---

## Database

Prisma models (`prisma/schema.prisma`): `Gateway`, `Device`, `Reading`, `Zone`,
`ZoneSensor`, `Alert`, `Admin`, `ThresholdConfig` — with primary/foreign keys,
unique device/gateway/zone IDs, timestamps, indexes, and a
`@@unique([deviceId, packetSequence])` guard for duplicate packets.

- **Engine:** PostgreSQL. `schema.prisma` uses `provider = "postgresql"` and
  reads `DATABASE_URL`. The deployed app uses a **Neon** PostgreSQL instance
  (pooled connection string); local dev can use any reachable Postgres URL.
- **Migrations:** version-controlled in `prisma/migrations/`. Apply to a
  database without dropping data via `npm run db:migrate`
  (`prisma migrate deploy`). A hand-written reference DDL also lives at
  `db/postgres/0001_init.sql`. See `prisma/README.md`.

Any local `*.db` files (from earlier SQLite-based prototypes) are gitignored.

---

## Security

- Device ingestion uses per-device bearer tokens; tokens are stored **hashed**
  (SHA-256 with a server-side pepper) and compared with `timingSafeEqual`.
- Admin passwords hashed with scrypt; sessions are HS256-signed HTTP-only,
  SameSite=Lax cookies (`jose`).
- Login uses a constant-shape path for unknown users to reduce user-enumeration.
- Input validated with Zod (strict), per-IP fixed-window rate limiting,
  duplicate-packet rejection, and secret-free error messages.
- Secrets live only in `.env` (gitignored). `.env.example` holds placeholders.
- The gateway is never authenticated by IP address.

---

## Firmware

`firmware/` documents the two ESP32 roles and the LoRa↔backend contract:

- `firmware/README.md` — overview and how the parts map to the data flow.
- `firmware/LORA_PACKET_FORMAT.md` — over-the-air node→gateway JSON and the
  gateway→backend payload (matches the ingestion schema above).
- `firmware/sensor_node/` — `sensor_node.ino` + README (ESP32-1 + SX1278 TX +
  water-level sensor).
- `firmware/gateway/` — `gateway.ino` + README (ESP32-2 + SX1278 RX + SIM800L
  GSM + NEO-6M GPS).

**SIM800L uses 2G GSM/GPRS.** Do not assume TLS/HTTPS works on every module or
network. The gateway README documents three transport options (plain HTTP to an
internal endpoint, a secure short-message/queue arrangement, or a separately
authenticated forwarder) so credentials are never exposed over an insecure link.
The exact water-sensor model and pinout must be confirmed against the physical
wiring before flashing.

---

## Testing

`npm test` runs 37 Vitest cases across classification, calibration,
haversine/zone assignment, stale/offline detection, duplicate-packet logic,
flow resolution, payload validation, device authentication, and password
hashing — without requiring a live database. Lint, type-check, and the
production build are part of the standard workflow.

---

## Environment variables

See `.env.example` for the authoritative list: `DATABASE_URL`, `AUTH_SECRET`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEVICE_TOKEN_SECRET`, `DEMO_MODE`,
`STALE_SECONDS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`.

In production, `DEMO_MODE` should be `false`, and placeholder secrets cause the
admin login endpoint to return `503` until real secrets are configured.

---

## Repository

Remote: `https://github.com/ajayesh14052010-svg/flood_detection` (branch
`main`). The initial commit contained only an empty `README.md`; this
implementation is layered on top of it without replacing the configured remote.
