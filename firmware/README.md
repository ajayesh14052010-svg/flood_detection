# FloodGuard firmware

Two ESP32 boards make up the field hardware:

| Board | Role | Connected hardware |
|-------|------|--------------------|
| **ESP32-1** | Sensor node | water-level sensor + SX1278 LoRa **transmitter** (433 MHz) |
| **ESP32-2** | Gateway | SX1278 LoRa **receiver** + SIM800L GSM/GPRS + NEO-6M GPS |

Data flow:

```
water-level sensor → ESP32-1 → SX1278 (TX) ~~ radio ~~ SX1278 (RX) → ESP32-2 gateway
   → SIM800L GPRS → authenticated backend API (POST /api/v1/devices/readings)
   → PostgreSQL → FloodGuard website
```

Sub-folders:

- [`sensor_node/`](sensor_node/) — ESP32-1 firmware + configuration.
- [`gateway/`](gateway/) — ESP32-2 firmware, LoRa→HTTP bridge, GPS, networking.
- [`LORA_PACKET_FORMAT.md`](LORA_PACKET_FORMAT.md) — the over-the-air packet contract.

## Libraries (Arduino / PlatformIO)

- ESP32 Arduino core
- `LoRa` (Sandor Szomolanyi / `sandeepmistry/arduino-LoRa`) — SX1278 433 MHz
- `ArduinoJson`
- `TinyGPSPlus` (NEO-6M, gateway only)

## Before flashing — you MUST configure

> **We do not assume the water-sensor model, its pinout, or its units.**
> FloodGuard stores the *raw* sensor value and only shows centimetres after an
> administrator configures a validated calibration in the web console.

Configure in every sketch:

1. **LoRa pins & frequency** — `RADIO_DIO0`, `RADIO_RST`, `RADIO_SS`, and
   `Frequency.begin(433E6)` to match your exact SX1278 breakout wiring.
2. **Water-level sensor** — ADC pin, sampling method (analog/digital/pulse),
   read interval. Record the **model number**; the raw→cm relationship is
   configured later in the dashboard, not in firmware.
3. **Device identity** — `FG-SENSOR-00x` and `FG-GATEWAY-002`. The gateway is
   identified by this **unique id, not its IP** (mobile IPs change and are often
   not publicly reachable).
4. **Device token** — provisioned by the admin console at registration. Store
   it in the device (e.g. `Preferences`/NVS), **never** commit it to Git.
5. **Backend base URL** — the reachable HTTPS endpoint of the FloodGuard API.

## Security notes

- Every device posts with `Authorization: Bearer <device_token>`. The server
  stores only a SHA-256 hash of the token (peppered server-side); it can verify
  but never recover the token.
- Tokens are shown **once** at registration and are **never** exposed on the
  public dashboard.
- The **SIM800L is 2G GSM/GPRS**. Do not assume TLS/HTTPS works on every
  module/network. See [`gateway/README.md`](gateway/README.md) for the secure
  transport options and their trade-offs.
