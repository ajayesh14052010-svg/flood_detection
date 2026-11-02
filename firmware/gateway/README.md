# Gateway (ESP32-2)

Receives LoRa from sensor nodes and forwards an enriched payload to the
authenticated backend. See [`gateway.ino`](gateway.ino).

## Identity

The gateway is known to the platform by its **unique gateway id**
(`FG-GATEWAY-002`), never by IP. Its latest reported IP is stored for
**diagnostics only**. Mobile IPs change and are usually not publicly reachable,
so an IP-based "login" would be unreliable and insecure.

## GPS — label it as gateway coordinates

The NEO-6M is on the gateway. Its fix is recorded as **gateway coordinates** and
is *not* copied onto remote sensors. A sensor's own location is set by an
administrator, so remote nodes never inherit the gateway's position by mistake.

## Network transport — verify the hardware first

The **SIM800L is a 2G GSM/GPRS module**. It has no practical modern TLS stack,
so **do not assume HTTPS works**. Pick one of these and verify it against your
actual module and carrier:

- **Option A — TLS-capable module.** Replace the SIM800L with a SIM7000/SIM7600
  class module that supports HTTPS, and post over TLS.
- **Option B — authenticated plaintext over a trusted link.** Use HTTP over
  GPRS but protect the transport another way: a private/closed APN, a carrier
  IP allow-list, and/or short-lived per-device tokens. Understand this exposes
  the bearer on the radio path.
- **Option C — local secure bridge.** The gateway posts over a trusted LAN /
  serial link to a small bridge that terminates TLS and forwards to the API.
  This keeps credentials off the 2G link.

FloodGuard's **preferred arrangement is Option A or C**. The device token is
never hardcoded in firmware source — load it from NVS/secure element.

## Backend call

```
POST /api/v1/devices/readings
Authorization: Bearer <device_token>
Content-Type: application/json
```

Handle `401` (bad token), `422` (malformed payload), `429` (rate limit), and
`200` with `duplicate:true` (already-stored sequence). On any failure, retry
with exponential backoff; the backend de-duplicates on `packet_sequence`, so a
resend after a lost ACK is safe.
