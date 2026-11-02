// Small helpers for consistent, safe JSON responses from route handlers.
// Error messages are intentionally generic — never leak stack traces, tokens,
// or database internals to clients.

import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(
  status: number,
  message: string,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Read a bearer device token from the standard or fallback header. */
export function deviceTokenFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return req.headers.get("x-device-token");
}

export function bearerTokenFromRequest(req: Request): string | null {
  return deviceTokenFromRequest(req);
}

/**
 * True for Prisma connection / initialisation failures — the class of error a
 * caller should surface as "temporarily unavailable" (503) rather than a bug
 * (500). We match on the error *name* and Prisma error *code* only, never on
 * `message`, because a PrismaClientInitializationError message can embed the
 * full connection string (credentials included).
 */
export function isDatabaseUnavailable(err: unknown): boolean {
  const e = err as { name?: string; code?: string };
  const name = e?.name ?? "";
  if (name.startsWith("PrismaClient")) return true;
  // P1001 can't reach db · P1003 db does not exist · P1008 pool timeout ·
  // P1009 connection was terminated · P1017 server closed connection.
  return ["P1001", "P1003", "P1008", "P1009", "P1017"].includes(e?.code ?? "");
}

/**
 * Wrap a route handler so database outages degrade gracefully: a safe 503 for
 * connection failures, a generic 500 otherwise. Only the error *name* is logged
 * server-side — never the message, which may contain credentials.
 */
export function handleRouteError(err: unknown): NextResponse {
  const name = (err as { name?: string })?.name ?? "Error";
  if (isDatabaseUnavailable(err)) {
    console.error(`[api] database unavailable (${name})`);
    return fail(503, "database_unavailable");
  }
  console.error(`[api] unhandled error (${name})`);
  return fail(500, "internal_error");
}
