// GET /api/v1/summary — public dashboard KPIs (all DB-derived).
import { ok } from "@/lib/http";
import { getDashboardSummary } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return ok(await getDashboardSummary());
}
