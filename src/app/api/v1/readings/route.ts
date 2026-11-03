// POST /api/v1/readings — authenticated sensor ingestion for directly-connected
// devices (e.g. a WiFi ESP32 that posts its own reading, without a LoRa gateway).
//
// This endpoint is the tolerant public face of the ingestion pipeline. It maps a
// range of realistic device field names onto the canonical ReadingPayload and
// then delegates to the SAME service used by /api/v1/devices/readings
// (duplicate detection, calibration, classification, device/gateway liveness,
// escalation alerts). Existing routes and the alerts API are untouched.
//
// Device tokens are verified against the stored peppered SHA-256 hash and are
// never logged or echoed. Errors are generic; DB-unavailable maps to 503.

import type { NextRequest } from "next/server";
import { ok, fail, deviceTokenFromRequest } from "@/lib/http";
import { authenticateDevice } from "@/lib/deviceAuth";
import { ingestReading } from "@/lib/ingest";
import { prisma } from "@/lib/db";
import { rateLimit, clientIpFromHeaders } from "@/lib/rateLimit";
import type { ReadingPayload } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// device/gateway ids: prefixed identifier, e.g. FG-SENSOR-001
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** First present, non-empty value among the given keys. */
function pick(obj: Obj, keys: string[]): unknown {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function toBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  return undefined;
}

/**
 * Translate a flexible device payload into the canonical ReadingPayload.
 * Returns an error string on the first unrecoverable problem.
 */
function mapToReadingPayload(body: Obj): { payload?: ReadingPayload; error?: string } {
  const deviceId = pick(body, ["device_id", "deviceId", "device"]);
  if (typeof deviceId !== "string" || !ID_PATTERN.test(deviceId)) {
    return { error: "device_id: a non-empty identifier is required" };
  }

  const gatewayIdRaw = pick(body, ["gateway_id", "gatewayId", "gateway"]);
  const gatewayId = typeof gatewayIdRaw === "string" ? gatewayIdRaw : "";

  // Raw sensor value: canonical first, then the common water-level / distance
  // spellings an ESP32 might post. Never centimetres — just the sensed value.
  let raw = toNumber(pick(body, ["raw_sensor_value", "rawSensorValue", "raw"]));
  if (raw === undefined) raw = toNumber(pick(body, ["waterLevel", "water_level", "level"]));
  if (raw === undefined) raw = toNumber(pick(body, ["distance", "cm", "range"]));
  if (raw === undefined) return { error: "raw_sensor_value: a numeric sensor value is required" };
  if (raw < 0) raw = 0;
  raw = Math.min(1_000_000, Math.round(raw));

  // A per-device monotonic sequence. If the device does not send one, derive it
  // from the (epoch-ms) timestamp so successive posts stay strictly increasing.
  let seq = toNumber(pick(body, ["packet_sequence", "packetSequence", "seq", "sequence"]));
  if (seq === undefined) {
    const ts = toNumber(pick(body, ["timestamp", "ts", "time"]));
    seq = ts !== undefined && ts > 1e9 ? Math.floor(ts) : Date.now();
  }
  seq = Math.max(0, Math.floor(seq));

  // Optional calibrated centimetres — the pipeline only trusts these once the
  // device's calibration is configured (so we never claim cm from a raw value).
  const calibratedCm = toNumber(
    pick(body, ["calibrated_water_level_cm", "waterLevelCm", "water_level_cm", "levelCm"])
  );
  const flowLpm = toNumber(pick(body, ["water_flow_lpm", "flow", "flow_lpm", "waterFlowLpm"]));

  const lat = toNumber(pick(body, ["latitude", "lat"]));
  const lng = toNumber(pick(body, ["longitude", "lng", "lon", "long"]));
  if (lat !== undefined && (lat < -90 || lat > 90)) return { error: "latitude: out of range" };
  if (lng !== undefined && (lng < -180 || lng > 180)) return { error: "longitude: out of range" };

  const battery = toNumber(pick(body, ["battery_voltage", "batteryVoltage", "bat", "voltage"]));
  const rssi = toNumber(pick(body, ["lora_rssi", "loraRssi", "rssi"]));
  const snr = toNumber(pick(body, ["lora_snr", "loraSnr", "snr"]));
  const fwRaw = pick(body, ["firmware_version", "firmwareVersion", "fw"]);
  const simulated = toBool(pick(body, ["simulated", "test", "demo"]));

  const payload: ReadingPayload = {
    device_id: deviceId,
    gateway_id: gatewayId,
    raw_sensor_value: raw,
    packet_sequence: seq,
    simulated: simulated ?? false,
  };
  if (calibratedCm !== undefined && calibratedCm >= 0) payload.calibrated_water_level_cm = calibratedCm;
  if (flowLpm !== undefined && flowLpm >= 0) payload.water_flow_lpm = flowLpm;
  if (lat !== undefined) payload.latitude = lat;
  if (lng !== undefined) payload.longitude = lng;
  if (battery !== undefined && battery >= 0 && battery <= 100) payload.battery_voltage = battery;
  if (rssi !== undefined && rssi <= 0 && rssi >= -200) payload.lora_rssi = Math.round(rssi);
  if (snr !== undefined && snr >= -50 && snr <= 50) payload.lora_snr = snr;
  if (typeof fwRaw === "string" && fwRaw.length <= 32) payload.firmware_version = fwRaw;

  return { payload };
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromHeaders(req.headers);
    const rl = rateLimit(`reading:${ip}`, undefined, 600, 60_000);
    if (!rl.ok) return fail(429, "rate_limited", { retryAfterMs: rl.retryAfterMs });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(400, "invalid_json");
    }
    if (!isObj(body)) return fail(422, "invalid_payload", { errors: ["body must be a JSON object"] });

    const mapped = mapToReadingPayload(body);
    if (!mapped.payload) {
      return fail(422, "invalid_payload", { errors: [mapped.error ?? "invalid payload"] });
    }
    const payload = mapped.payload;

    const token = deviceTokenFromRequest(req);
    const device = await authenticateDevice(payload.device_id, token);
    if (!device) {
      // Do not reveal whether the device exists or the token is wrong.
      return fail(401, "unauthorized");
    }

    let gateway: { id: number } | null = null;
    if (payload.gateway_id) {
      gateway = await prisma.gateway.findUnique({
        where: { gatewayId: payload.gateway_id },
        select: { id: true },
      });
    }

    const reportedIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const result = await ingestReading(payload, device, {
      gatewayDbId: gateway?.id ?? null,
      reportedIp,
    });

    if (result.reason === "device_not_found") return fail(404, "device_not_found");

    const isNew = !result.duplicate && !!result.readingId;
    return ok(
      {
        ok: true,
        duplicate: result.duplicate,
        status: result.status,
        calibrated_water_level_cm: result.calibratedCm,
        alert_created: result.alertCreated,
        reading_id: result.readingId ?? null,
      },
      { status: isNew ? 201 : 200 }
    );
  } catch (e) {
    // Connection/init failures degrade to 503; anything else is a generic 500.
    // Match on error *name* and Prisma *code* only — a PrismaClientInit message
    // can embed the connection string (credentials included), so never log it.
    const name = (e as { name?: string })?.name ?? "Error";
    const code = (e as { code?: string })?.code ?? "";
    const dbDown =
      name.startsWith("PrismaClient") ||
      ["P1001", "P1003", "P1008", "P1009", "P1017"].includes(code);
    console.error(`[api/readings] ${dbDown ? "database unavailable" : "unhandled error"} (${name})`);
    return dbDown ? fail(503, "database_unavailable") : fail(500, "internal_error");
  }
}
