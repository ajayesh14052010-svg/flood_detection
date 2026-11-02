// GET /api/v1/gateways/[gatewayId] — device diagnostics for a gateway (ESP32-2).
// The gateway is identified by its unique id, never its IP. The IP is shown for
// diagnostics only.
import type { NextRequest } from "next/server";
import { ok, fail, handleRouteError } from "@/lib/http";
import { getGatewayDiagnostics } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gatewayId: string }> }
) {
  const { gatewayId } = await params;
  try {
    const diag = await getGatewayDiagnostics(decodeURIComponent(gatewayId));
    if (!diag) return fail(404, "gateway_not_found");
    return ok(diag);
  } catch (err) {
    return handleRouteError(err);
  }
}
