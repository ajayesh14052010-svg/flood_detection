// GET /api/v1/alerts/export — download all published alerts as CSV (public).
// Mirrors the on-screen Alerts table so the community can keep a record.
import { getAlerts } from "@/lib/queries";
import { toCsv, csvDownloadHeaders } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const alerts = await getAlerts(true);
  const csv = toCsv(
    ["created_at_utc", "type", "severity", "device_id", "acknowledged", "simulated", "message"],
    alerts.map((a) => [
      a.createdAt.toISOString(),
      a.type,
      a.severity,
      a.deviceId ?? "",
      a.acknowledged ? "yes" : "no",
      a.simulated ? "yes" : "no",
      a.message,
    ])
  );
  return new Response(csv, { headers: csvDownloadHeaders("floodguard-alerts.csv") });
}
