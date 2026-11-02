// Server-only environment configuration.
//
// Design note: this module must NOT throw at import time — it is pulled in by
// route handlers and server components, including during `next build`. Instead,
// unsafe/placeholder secrets in production are detected with
// `usingPlaceholderSecrets()` and enforced at the authentication boundary
// (login / device ingestion), where a real misconfiguration should fail closed.

import { DEFAULT_THRESHOLDS } from "./types";

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function readSecret(name: string, fallback: string): string {
  const v = process.env[name];
  if (v && v.trim().length > 0 && !v.startsWith("change-me")) return v;
  return fallback;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

const AUTH_SECRET = readSecret("AUTH_SECRET", "dev-only-auth-secret");
const DEVICE_TOKEN_SECRET = readSecret("DEVICE_TOKEN_SECRET", "dev-only-device-secret");

export const env = {
  AUTH_SECRET,
  DEVICE_TOKEN_SECRET,
  DEMO_MODE: (process.env.DEMO_MODE ?? "false").toLowerCase() === "true",
  STALE_SECONDS: intFromEnv("STALE_SECONDS", DEFAULT_THRESHOLDS.staleSeconds),
  RATE_LIMIT_MAX: intFromEnv("RATE_LIMIT_MAX", 120),
  RATE_LIMIT_WINDOW_MS: intFromEnv("RATE_LIMIT_WINDOW_MS", 60000),
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@example.local",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "change-me-admin-password",
};

/**
 * True when running in production with a placeholder secret — a real
 * deployment must set AUTH_SECRET / DEVICE_TOKEN_SECRET before serving.
 */
export function usingPlaceholderSecrets(): boolean {
  if (!isProd()) return false;
  return (
    AUTH_SECRET === "dev-only-auth-secret" ||
    DEVICE_TOKEN_SECRET === "dev-only-device-secret"
  );
}
