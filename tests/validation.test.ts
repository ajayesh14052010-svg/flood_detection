import { describe, it, expect } from "vitest";
import { validateReadingPayload } from "@/lib/validation";

const valid = {
  device_id: "FG-SENSOR-001",
  gateway_id: "FG-GATEWAY-002",
  raw_sensor_value: 2450,
  calibrated_water_level_cm: null,
  water_flow_lpm: null,
  flood_status: "CALIBRATION_REQUIRED",
  latitude: null,
  longitude: null,
  battery_voltage: null,
  lora_rssi: null,
  lora_snr: null,
  packet_sequence: 1,
  firmware_version: "1.0.0",
  simulated: false,
};

describe("API payload validation", () => {
  it("accepts the documented example payload", () => {
    const r = validateReadingPayload(valid);
    expect(r.ok).toBe(true);
    expect(r.data?.device_id).toBe("FG-SENSOR-001");
  });
  it("defaults `simulated` to false when omitted", () => {
    const { simulated, ...rest } = valid;
    const r = validateReadingPayload(rest);
    expect(r.ok).toBe(true);
    expect(r.data?.simulated).toBe(false);
  });
  it("rejects a payload missing the required device_id", () => {
    const { device_id, ...rest } = valid;
    const r = validateReadingPayload(rest);
    expect(r.ok).toBe(false);
    expect(r.errors?.join(" ")).toMatch(/device_id/);
  });
  it("rejects unknown keys (strict schema)", () => {
    const r = validateReadingPayload({ ...valid, hacker_field: 1 });
    expect(r.ok).toBe(false);
  });
  it("rejects a negative raw value and an out-of-range latitude", () => {
    expect(validateReadingPayload({ ...valid, raw_sensor_value: -5 }).ok).toBe(false);
    expect(validateReadingPayload({ ...valid, latitude: 200 }).ok).toBe(false);
  });
  it("rejects a non-integer packet_sequence", () => {
    expect(validateReadingPayload({ ...valid, packet_sequence: 1.5 }).ok).toBe(false);
  });
  it("rejects an unknown flood_status value", () => {
    expect(validateReadingPayload({ ...valid, flood_status: "BOGUS" }).ok).toBe(false);
  });
});
