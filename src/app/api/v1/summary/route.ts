// GET /api/v1/summary — public dashboard KPIs (all DB-derived).
import { ok, handleRouteError } from "@/lib/http";
import { getDashboardSummary } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getDashboardSummary());
  } catch (err) {
    return handleRouteError(err);
  }
}
