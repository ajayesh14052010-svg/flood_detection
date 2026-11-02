// Admin session tokens (JWT). No `next/*` imports — the pure sign/verify
// primitives live here so unit tests can run in Node. The cookie plumbing that
// reads the token from a request lives in auth.ts.

import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

export const ADMIN_COOKIE = "fg_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function signAdminSession(admin: {
  id: number;
  email: string;
}): Promise<string> {
  return new SignJWT({ email: admin.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(admin.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyAdminSession(
  token: string
): Promise<{ id: number; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    const id = Number.parseInt(payload.sub ?? "", 10);
    if (!Number.isFinite(id)) return null;
    return { id, email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}
