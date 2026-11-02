// GET /api/v1/admin/session — report whether the caller is an authenticated
// admin. Used by the admin console UI to gate rendering (the real gate is on
// every admin mutation route, which re-checks this server-side).

import type { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { verifyAdminSession, ADMIN_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const session = token ? await verifyAdminSession(token) : null;
  return ok({ ok: true, authenticated: Boolean(session), email: session?.email ?? null });
}
