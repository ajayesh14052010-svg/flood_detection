# Database

FloodGuard uses **PostgreSQL** as its database engine. `prisma/schema.prisma`
sets `provider = "postgresql"` and reads the connection string from
`DATABASE_URL`. The deployed app (Vercel) points at a **Neon** PostgreSQL
instance; local development can point at any reachable PostgreSQL URL.

## Connection string

Use the **pooled** Neon connection string in `.env` and in the Vercel project
settings. It looks like:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

- Use the `-pooler` host for serverless/Vercel (bounded connection count).
- Never commit the real string — `.env` is gitignored; `.env.example` has a
  placeholder.

## Applying the schema (does not delete data)

Migrations are version-controlled under `prisma/migrations/`. The initial
migration (`20260101000000_init`) creates all tables, keys, indexes and the
`@@unique([deviceId, packetSequence])` duplicate-packet guard.

```bash
npx prisma migrate deploy   # applies pending migrations to DATABASE_URL
```

`migrate deploy` is additive/idempotent for an empty database and never drops
existing data. For local iteration you can instead use `npx prisma migrate dev`.

A hand-written reference DDL also lives at
[`../db/postgres/0001_init.sql`](../db/postgres/0001_init.sql).

## Optional demo data

```bash
npm run db:seed             # clearly-labelled SIMULATED demo data (optional)
```

## Data-quality rules encoded in the model

- `raw_sensor_value` is the raw sensor reading and is **never** presented as centimetres.
- `calibrated_water_level_cm` is `NULL` until an admin configures calibration
  (`calibration_slope` / `calibration_intercept` on the device).
- `water_flow_lpm` is `NULL` unless a real flow sensor or validated model exists;
  `flow_source` marks it `MEASURED` vs `ESTIMATED`. **Flow is never invented.**
- Device credentials are stored as `token_hash` (SHA-256) + `token_prefix` only.
- `simulated = true` rows are demo data and are clearly separated from real readings.
