// Server-only crypto helpers. Uses Node's built-in crypto (no native deps):
//  - SHA-256 for device token digests
//  - scrypt for admin password hashing
//  - timingSafeEqual for constant-time comparison

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Hash a device token with a server-side pepper (DEVICE_TOKEN_SECRET) so a
 * leaked database alone is not enough to reconstruct/compare tokens offline.
 * Every component that stores or verifies device tokens must use this.
 */
export function hashDeviceToken(token: string, pepper: string): string {
  return sha256Hex(`${pepper}:${token}`);
}

/** Generate a URL-safe random device token (shown once at registration). */
export function generateDeviceToken(): string {
  return `fgd_${randomBytes(24).toString("hex")}`;
}

export function tokenPrefix(token: string): string {
  return token.slice(0, 12);
}

/** Hash an admin password with a random scrypt salt, stored as salt:hash. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Constant-time compare of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
