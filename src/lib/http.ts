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
