import { describe, it, expect } from "vitest";
import { classifyLevel, classifyReading, effectiveStatus } from "@/lib/classify";
import { calibrateToCm, isCalibrationUsable } from "@/lib/calibration";
import {
  haversineMeters,
  isWithinRadius,
  assignDevicesToZones,
} from "@/lib/geo";
import { evaluateFreshness } from "@/lib/stale";
import { resolveFlow, flowStats } from "@/lib/flow";
import { isDuplicatePacket } from "@/lib/ingest";
import { DEFAULT_THRESHOLDS, FLOOD_STATUS } from "@/lib/types";

const T = DEFAULT_THRESHOLDS; // watch 30, warning 60, critical 100

describe("sensor classification", () => {
  it("classifies calibrated centimetres against thresholds", () => {
    expect(classifyLevel(10, T)).toBe(FLOOD_STATUS.NORMAL);
    expect(classifyLevel(35, T)).toBe(FLOOD_STATUS.WATCH);
    expect(classifyLevel(61, T)).toBe(FLOOD_STATUS.WARNING);
    expect(classifyLevel(140, T)).toBe(FLOOD_STATUS.CRITICAL);
  });
  it("returns CALIBRATION_REQUIRED when there is no cm value", () => {
    expect(classifyLevel(null, T)).toBe(FLOOD_STATUS.CALIBRATION_REQUIRED);
  });
  it("ignores thresholds entirely when calibration is not configured", () => {
    expect(
      classifyReading({ calibratedCm: 500, calibrationConfigured: false, thresholds: T })
    ).toBe(FLOOD_STATUS.CALIBRATION_REQUIRED);
  });
  it("layers offline and stale on top of the measured status", () => {
    expect(
      effectiveStatus({ lastMeasuredStatus: FLOOD_STATUS.NORMAL, isOnline: true, isStale: true })
    ).toBe(FLOOD_STATUS.DATA_STALE);
    expect(
      effectiveStatus({ lastMeasuredStatus: FLOOD_STATUS.WARNING, isOnline: false, isStale: false })
    ).toBe(FLOOD_STATUS.SENSOR_OFFLINE);
  });
});

describe("calibration", () => {
  it("never returns centimetres without a configured calibration", () => {
    expect(calibrateToCm(2450, { configured: false, slope: 1, intercept: 0 })).toBeNull();
  });
  it("applies cm = slope * raw + intercept", () => {
    expect(calibrateToCm(2450, { configured: true, slope: 0.02, intercept: 0 })).toBeCloseTo(49, 5);
  });
  it("clamps physically-invalid negative levels to zero", () => {
    expect(calibrateToCm(100, { configured: true, slope: -0.1, intercept: 5 })).toBe(0);
  });
  it("requires a positive slope to be usable", () => {
    expect(isCalibrationUsable({ configured: true, slope: 0, intercept: 0 })).toBe(false);
    expect(isCalibrationUsable({ configured: true, slope: 0.02, intercept: 0 })).toBe(true);
  });
});

describe("monitoring-zone calculations", () => {
  it("computes ~0 distance for identical points", () => {
    expect(haversineMeters(13.0827, 80.27, 13.0827, 80.27)).toBeLessThan(0.01);
  });
  it("computes roughly the right metres for a 0.001 deg latitude step", () => {
    // 1 degree latitude ≈ 111,320 m, so 0.001 deg ≈ 111 m.
    const d = haversineMeters(13.0827, 80.27, 13.0837, 80.27);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
  it("a point 25 m out is inside a 50 m zone; 80 m out is not", () => {
    const lat = 13.0827;
    const lng = 80.27;
    const mPerDegLat = 111320;
    const near = lat + 25 / mPerDegLat;
    const far = lat + 80 / mPerDegLat;
    expect(isWithinRadius(lat, lng, near, lng, 50)).toBe(true);
    expect(isWithinRadius(lat, lng, far, lng, 50)).toBe(false);
  });
  it("assigns located devices and skips unlocated ones", () => {
    const center = { zoneId: "FG-ZONE-001", centerLat: 13.0827, centerLng: 80.27, radiusMeters: 50 };
    const mPerDeg = 111320;
    const devices = [
      { deviceId: "A", latitude: 13.0827 + 20 / mPerDeg, longitude: 80.27, hasLocation: true },
      { deviceId: "B", latitude: 13.0827 + 200 / mPerDeg, longitude: 80.27, hasLocation: true },
      { deviceId: "C", latitude: null, longitude: null, hasLocation: false },
    ];
    const result = assignDevicesToZones(devices, [center]);
    expect(result.map((r) => r.deviceId)).toEqual(["A"]);
  });
  it("handles overlapping zones without duplicating a device within one zone", () => {
    const mPerDeg = 111320;
    const z1 = { zoneId: "FG-ZONE-001", centerLat: 13.0827, centerLng: 80.27, radiusMeters: 50 };
    const z2 = { zoneId: "FG-ZONE-002", centerLat: 13.0827 + 30 / mPerDeg, centerLng: 80.27, radiusMeters: 50 };
    const devices = [
      { deviceId: "X", latitude: 13.0827 + 10 / mPerDeg, longitude: 80.27, hasLocation: true },
    ];
    const result = assignDevicesToZones(devices, [z1, z2]);
    // X falls in both circles -> listed once per zone (never twice per zone).
    const ids = result.map((r) => r.zoneId);
    expect(new Set(result.filter((r) => r.deviceId === "X").map((r) => r.zoneId)).size).toBe(ids.length);
  });
});

describe("stale-data / offline detection", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("is current when fresh", () => {
    const r = evaluateFreshness({ lastSeenAt: new Date(now.getTime() - 1000), now, staleSeconds: 900 });
    expect(r.isStale).toBe(false);
    expect(r.isOffline).toBe(false);
  });
  it("is stale past staleSeconds", () => {
    const r = evaluateFreshness({ lastSeenAt: new Date(now.getTime() - 1000 * 1000), now, staleSeconds: 900 });
    expect(r.isStale).toBe(true);
    expect(r.isOffline).toBe(false);
  });
  it("is offline past staleSeconds * 2", () => {
    const r = evaluateFreshness({ lastSeenAt: new Date(now.getTime() - 1000 * 3000), now, staleSeconds: 900 });
    expect(r.isOffline).toBe(true);
  });
  it("never-seen devices are treated as offline", () => {
    const r = evaluateFreshness({ lastSeenAt: null, now, staleSeconds: 900 });
    expect(r.isOffline).toBe(true);
    expect(r.ageSeconds).toBeNull();
  });
});

describe("flow-data validation", () => {
  it("is unavailable and shows the required message when there is no flow sensor", () => {
    const r = resolveFlow({ waterFlowLpm: null, flowSource: null });
    expect(r.available).toBe(false);
    expect(r.message).toBe("Flow data unavailable — additional sensor or validated model required.");
  });
  it("marks model results as estimated", () => {
    const r = resolveFlow({ waterFlowLpm: 120, flowSource: "ESTIMATED" });
    expect(r.available).toBe(true);
    expect(r.estimated).toBe(true);
  });
  it("computes max/avg over measured samples and ignores nulls", () => {
    const s = flowStats([10, null, 30, 50]);
    expect(s.count).toBe(3);
    expect(s.max).toBe(50);
    expect(s.avg).toBeCloseTo(30, 5);
  });
});

describe("duplicate packet handling", () => {
  it("rejects a sequence not greater than the last accepted", () => {
    expect(isDuplicatePacket(5, 5)).toBe(true);
    expect(isDuplicatePacket(4, 5)).toBe(true);
    expect(isDuplicatePacket(6, 5)).toBe(false);
  });
  it("accepts the first packet from a fresh device", () => {
    expect(isDuplicatePacket(1, 0)).toBe(false);
  });
});
