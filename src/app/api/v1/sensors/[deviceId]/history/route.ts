// GET /api/v1/sensors/[deviceId]/history — download a sensor's stored readings
// as CSV. Public, matching the public historical chart. Raw values are included
// alongside calibrated cm (null until calibration) so nothing is misrepresented.
import type { NextRequest } from "next/server";
import { fail, handleRouteError } from "@/lib/http";
import { getSensorDetail } from "@/lib/queries";
import { toCsv, csvDownloadHeaders } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const id = decodeURIComponent(deviceId);
  try {
    const { sensor, history } = await getSensorDetail(id, 5000);
    if (!sensor) return fail(404, "sensor_not_found");

    const csv = toCsv(
      ["received_at_utc", "raw_sensor_value", "calibrated_water_level_cm", "water_flow_lpm", "flood_status"],
      history.map((h) => [
        new Date(h.t).toISOString(),
        h.raw,
        h.cm ?? "",
        h.flow ?? "",
        h.status,
      ])
    );
    return new Response(csv, { headers: csvDownloadHeaders(`${id}-history.csv`) });
  } catch (err) {
    return handleRouteError(err);
  }
}
