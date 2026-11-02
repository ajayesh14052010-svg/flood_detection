// Device authentication — deliberately kept free of any `next/*` imports so
// the ingestion service and unit tests can call it directly in Node.

import { prisma } from "./db";
import { env } from "./env";
import { hashDeviceToken, safeEqualHex } from "./crypto";

export interface AuthenticatedDevice {
  id: number;
  deviceId: string;
  gatewayId: number | null;
}

/**
 * Verify a device bearer token against the stored SHA-256 hash. Returns the
 * device when the token matches, otherwise null. The token itself is never
 * logged or returned.
 */
export async function authenticateDevice(
  deviceId: string,
  token: string | null | undefined
): Promise<AuthenticatedDevice | null> {
  if (!token) return null;
  const device = await prisma.device.findUnique({
    where: { deviceId },
    select: { id: true, deviceId: true, gatewayId: true, tokenHash: true },
  });
  if (!device) return null;
  const candidate = hashDeviceToken(token, env.DEVICE_TOKEN_SECRET);
  if (!safeEqualHex(candidate, device.tokenHash)) return null;
  return { id: device.id, deviceId: device.deviceId, gatewayId: device.gatewayId };
}
