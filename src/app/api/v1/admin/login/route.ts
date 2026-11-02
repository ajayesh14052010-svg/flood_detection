// POST /api/v1/admin/login — authenticate an administrator and set a signed,
// httpOnly session cookie. Passwords are verified against a scrypt hash; the
// production password is supplied via the admin record, never hardcoded here.

import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { signAdminSession, adminCookieOptions } from "@/lib/auth";
import { usingPlaceholderSecrets } from "@/lib/env";
import { rateLimit, clientIpFromHeaders } from "@/lib/rateLimit";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1).max(200),
  })
  .strict();

export async function POST(req: NextRequest) {
  // Fail closed in production if running with the placeholder signing secret.
  if (usingPlaceholderSecrets()) {
    return fail(503, "auth_not_configured");
  }

  const ip = clientIpFromHeaders(req.headers);
  // Stricter limit for the credential endpoint to blunt brute force.
  const rl = rateLimit(`login:${ip}`, undefined, 10, 60_000);
  if (!rl.ok) return fail(429, "rate_limited", { retryAfterMs: rl.retryAfterMs });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(422, "invalid_credentials");

  const admin = await prisma.admin.findUnique({ where: { email: parsed.data.email } });
  // Compare against a constant-shape check even when the user is unknown to
  // avoid trivial user-enumeration timing.
  const valid = admin
    ? verifyPassword(parsed.data.password, admin.passwordHash)
    : verifyPassword(parsed.data.password, "00:00");

  if (!admin || !valid) {
    return fail(401, "invalid_credentials");
  }

  const token = await signAdminSession({ id: admin.id, email: admin.email });
  const cookieOpts = { ...adminCookieOptions(), value: token };
  const res = ok({ ok: true, email: admin.email, name: admin.name });
  res.cookies.set(cookieOpts);
  return res;
}
