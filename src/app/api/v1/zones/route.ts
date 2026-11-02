// GET /api/v1/zones — monitoring zones with severity rollups.
import { ok } from "@/lib/http";
import { getZones } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return ok(await getZones());
}
