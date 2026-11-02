// GET /api/v1/alerts — published alerts (public read).
import type { NextRequest } from "next/server";
import { ok, handleRouteError } from "@/lib/http";
import { getAlerts } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const includeAcked = req.nextUrl.searchParams.get("include_acknowledged") !== "false";
  try {
    return ok(await getAlerts(includeAcked));
  } catch (err) {
    return handleRouteError(err);
  }
}
