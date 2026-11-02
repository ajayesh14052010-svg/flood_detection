import Link from "next/link";
import { getDashboardSummary, getAlerts } from "@/lib/queries";
import { Card, StatCard } from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import { formatCm, formatTime } from "@/lib/format";
import { WAITING_FOR_DATA_MESSAGE } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const alerts = (await getAlerts(false)).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Public Flood Dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Live water-level monitoring from community IoT sensors. Last data update:{" "}
          <strong>{formatTime(summary.lastDataUpdate)}</strong>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Sensors" value={summary.totalSensors} hint="registered" />
        <StatCard label="Online" value={summary.online} tone="green" />
        <StatCard label="Offline" value={summary.offline} tone="slate" />
        <StatCard label="Warning" value={summary.warning} tone="orange" />
        <StatCard label="Critical" value={summary.critical} tone="red" />
        <StatCard label="Zones" value={summary.monitoringZones} hint="50 m circles" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Latest reported water levels"
          subtitle="Highest readings across all sensors"
        >
          {summary.latestLevels.length === 0 ? (
            <p className="text-sm text-slate-500">{WAITING_FOR_DATA_MESSAGE}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {summary.latestLevels.map((l) => (
                <li key={l.deviceId} className="flex items-center justify-between py-2">
                  <Link href={`/sensors/${l.deviceId}`} className="hover:text-sky-700">
                    <span className="font-mono text-sm">{l.deviceId}</span>
                    <span className="ml-2 text-xs text-slate-500">{l.name}</span>
                  </Link>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatCm(l.cm)}</span>
                    <StatusBadge status={l.status} simulated={l.simulated} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Latest alerts"
          subtitle={
            <span>
              {summary.activeAlerts} active ·{" "}
              <Link href="/alerts" className="text-sky-600 hover:underline">
                view all
              </Link>
            </span>
          }
        >
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500">No active alerts.</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                  <StatusBadge status={a.type} simulated={a.simulated} />
                  <p className="mt-1 text-slate-600">{a.message}</p>
                  <p className="text-xs text-slate-400">{formatTime(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/map" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
          Open Live Flood Map
        </Link>
        <Link href="/sensors" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          All sensors
        </Link>
        <Link href="/zones" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Monitoring zones
        </Link>
      </div>
    </div>
  );
}
