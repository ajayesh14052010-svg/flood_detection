# Sensor node (ESP32-1)

Transmits raw water-level readings over LoRa. See
[`sensor_node.ino`](sensor_node.ino) for the illustrative sketch.

## Configure before flashing

- LoRa pins + `433E6`, SF/BW/CR (must match the gateway).
- `DEVICE_ID` (`FG-SENSOR-00x`) and the provisioning `DEVICE_TOKEN` (from NVS).
- The water-level sensor **pin and read method** for your actual module — the
  firmware only produces a `raw` integer.

## Calibration is done in the dashboard, not here

The node never computes centimetres. After an administrator enters a validated
`cm = slope × raw + intercept` in the admin console, the backend converts raw
values. Until then the site shows **"Raw sensor reading — calibration
required."**

Suggested field-calibration procedure:

1. Take at least two reference measurements with a known gauge (e.g. 0 cm and a
   measured high-water mark), recording the raw value at each.
2. Solve for `slope` and `intercept` from those two points.
3. Enter them against the device in the admin console and verify subsequent raw
   readings map to sensible centimetres before trusting alerts.

## Battery / power

`bat` is `0` in the example. Wire a divider to an ADC pin (or use a fuel-gauge
IC) and report volts; the gateway/diagnostics page shows it when present.
