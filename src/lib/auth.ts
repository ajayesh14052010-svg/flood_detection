// Admin authentication glue for the web layer: reads/sets the session cookie
// and re-exports the pure JWT helpers. Route handlers keep importing from
// "@/lib/auth"; unit tests import from "@/lib/adminToken" to avoid next/headers.

import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  signAdminSession,
  verifyAdminSession,
} from "./adminToken";

export { ADMIN_COOKIE, signAdminSession, verifyAdminSession };

const SESSION_TTL_SECONDS = 60 * 60 * 8; // kept in sync with adminToken.ts

/** Read + verify the admin session from the incoming request cookies. */
export async function getAdminFromRequest(): Promise<{
  id: number;
  email: string;
} | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminSession(token);
}

export function adminCookieOptions(): {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    name: ADMIN_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
