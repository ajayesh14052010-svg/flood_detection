import Link from "next/link";
import { getAlerts } from "@/lib/queries";
import StatusBadge from "@/components/StatusBadge";
import { Card } from "@/components/Card";
import { formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const alerts = await getAlerts(true);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Alerts</h1>
          <p className="text-sm text-slate-500">
            Flood warnings, critical alerts, offline sensors and stale data. Readings marked
            SIMULATED are demo data.
          </p>
        </div>
        <a
          href="/api/v1/alerts/export"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Download CSV
        </a>
      </div>

      <Card>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">No alerts have been recorded.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.type} simulated={a.simulated} />
                    {a.acknowledged ? (
                      <span className="text-xs font-medium text-green-700">Acknowledged</span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">Unacknowledged</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{a.message}</p>
                  <p className="text-xs text-slate-400">
                    {formatTime(a.createdAt)}
                    {a.deviceId ? (
                      <>
                        {" · "}
                        <Link href={`/sensors/${a.deviceId}`} className="text-sky-600 hover:underline">
                          {a.deviceId}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
