# LoRa packet format (ESP32-1 → ESP32-2)

The sensor node transmits a compact **JSON** packet over LoRa. The gateway
receives it, wraps it with its own metadata (RSSI/SNR, gateway id, GPS) and
POSTs it to the backend. Keeping the schema identical across firmware, backend,
database, and website is required.

## Transport settings (must match on both boards)

| Setting | Example value | Notes |
|---------|---------------|-------|
| Frequency | `433E6` | SX1278 433 MHz module |
| Spread factor (SF) | `9` | higher SF = longer range, slower |
| Signal BW | `125E3` | |
| Coding rate | `7` | |
| Preamble | `8` | |
| Sync word | `0x12` | same public default; set identically |
| TX power | `14..17` dBm | legal value depends on region |

> LoRa payload is limited (a few tens of bytes at high SF). Keep field names
> short. If your link budget requires it, switch to the packed binary format in
> the appendix below.

## Over-the-air JSON (node → gateway)

```jsonc
{
  "d": "FG-SENSOR-001",        // device_id
  "seq": 137,                   // packet_sequence (monotonic per device)
  "raw": 2450,                  // raw_sensor_value (NOT centimetres)
  "bat": 3.84,                  // battery_voltage (V), or null
  "t": 1730505600               // device epoch seconds (optional)
}
```

The node does **not** know centimetres, thresholds, GPS, or LoRa link quality —
those are added by the gateway and the backend.

## Gateway → backend payload (`POST /api/v1/devices/readings`)

The gateway forwards an enriched payload with the **exact** schema the API
expects:

```jsonc
{
  "device_id": "FG-SENSOR-001",
  "gateway_id": "FG-GATEWAY-002",
  "raw_sensor_value": 2450,
  "calibrated_water_level_cm": null,   // gateway never computes cm; backend + calibration own this
  "water_flow_lpm": null,              // null unless a real flow sensor/model exists — never invented
  "flood_status": "CALIBRATION_REQUIRED", // advisory; backend reclassifies authoritatively
  "latitude": null,                    // sensor location (null if the node has no GPS)
  "longitude": null,
  "battery_voltage": 3.84,
  "lora_rssi": -83,                    // link metrics measured at the GATEWAY
  "lora_snr": 9.1,
  "packet_sequence": 137,
  "firmware_version": "1.0.0",
  "simulated": false
}
```

### Handling rules enforced by the backend

- `calibrated_water_level_cm` is ignored unless the device has calibration
  configured; otherwise the level stays `CALIBRATION_REQUIRED`.
- `packet_sequence` must be strictly greater than the last stored value per
  device — equal/lower = **duplicate**, rejected (also guarded by a unique index).
- The **gateway's GPS is labelled as gateway coordinates**, never copied onto
  the remote sensor. A sensor's own location is set by an administrator.
- `water_flow_lpm` present only when genuinely measured/estimated; the UI shows
  "Flow data unavailable" otherwise.

## Appendix — packed binary (optional)

For tight links, replace JSON with a fixed little-endian struct and CRC16:

```
u16 magic (0xF6) | u8 ver | u16 seq | i16 rssi | i8 snr | u8 dev_id_idx | i32 raw | u16 bat_mV | u16 crc16
```

The backend contract is unchanged — the gateway decodes this into the JSON
payload above.
