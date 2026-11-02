// GET /api/v1/zones — monitoring zones with severity rollups.
import { ok, handleRouteError } from "@/lib/http";
import { getZones } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getZones());
  } catch (err) {
    return handleRouteError(err);
  }
}
