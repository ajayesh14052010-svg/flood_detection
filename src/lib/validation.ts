// Ingestion payload validation (zod). The schema mirrors the device API
// contract so it stays consistent across firmware, backend, and DB.

import { z } from "zod";
import { FLOOD_STATUS } from "./types";

const statusValues = Object.values(FLOOD_STATUS) as [string, ...string[]];

// Device/gateway ids: prefixed identifier, e.g. FG-SENSOR-001 / FG-GATEWAY-002.
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;

export const readingPayloadSchema = z
  .object({
    device_id: z.string().regex(idPattern, "invalid device_id"),
    gateway_id: z.string().regex(idPattern, "invalid gateway_id"),
    raw_sensor_value: z.number().int().min(0).max(1_000_000),
    calibrated_water_level_cm: z.number().finite().min(0).nullable().optional(),
    water_flow_lpm: z.number().finite().min(0).nullable().optional(),
    flood_status: z.enum(statusValues).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    battery_voltage: z.number().finite().min(0).max(100).nullable().optional(),
    lora_rssi: z.number().int().min(-200).max(0).nullable().optional(),
    lora_snr: z.number().finite().min(-50).max(50).nullable().optional(),
    packet_sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    firmware_version: z.string().max(32).nullable().optional(),
    simulated: z.boolean().default(false),
  })
  .strict(); // reject unknown/malformed keys

export type ReadingPayload = z.infer<typeof readingPayloadSchema>;

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  errors?: string[];
}

export function validateReadingPayload(
  input: unknown
): ValidationResult<ReadingPayload> {
  const parsed = readingPayloadSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors = parsed.error.issues.map(
    (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
  );
  return { ok: false, errors };
}

export const registerDeviceSchema = z
  .object({
    device_id: z.string().regex(idPattern),
    name: z.string().min(1).max(120),
    gateway_id: z.string().regex(idPattern).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .strict();
