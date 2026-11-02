// GET /api/v1/live — compact snapshot for the interactive map (client polled).
import { ok } from "@/lib/http";
import { getLiveSnapshot } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return ok(await getLiveSnapshot());
}
