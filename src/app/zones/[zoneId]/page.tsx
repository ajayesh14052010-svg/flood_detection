import Link from "next/link";
import { notFound } from "next/navigation";
import { getZones } from "@/lib/queries";
import StatusBadge from "@/components/StatusBadge";
import { Card } from "@/components/Card";
import { formatCm, formatTime } from "@/lib/format";
import { FLOW_UNAVAILABLE_MESSAGE } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ZoneDetailPage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  const zones = await getZones();
  const zone = zones.find((z) => z.zoneId === decodeURIComponent(zoneId));
  if (!zone) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-2xl font-bold text-slate-900">{zone.zoneId}</h1>
        <Link href="/zones" className="text-sm text-sky-600 hover:underline">
          ← all zones
        </Link>
      </div>
      <p className="text-sm text-slate-500">{zone.name}</p>

      <Card>
        <div className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
          This is a {zone.radiusMeters}-metre monitoring zone around a sensor point —{" "}
          <strong>not</strong> an official government ward or administrative boundary.
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Centre</dt>
            <dd className="font-mono">
              {zone.centerLat.toFixed(5)}, {zone.centerLng.toFixed(5)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Radius</dt>
            <dd>{zone.radiusMeters} m</dd>
          </div>
          <div>
            <dt className="text-slate-500">Highest severity</dt>
            <dd>{zone.highestSeverity ? <StatusBadge status={zone.highestSeverity} /> : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Last update</dt>
            <dd>{formatTime(zone.lastUpdate)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Highest water level</dt>
            <dd>{formatCm(zone.latestLevelCm)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Flow data</dt>
            <dd>{zone.hasFlowData ? "Available" : FLOW_UNAVAILABLE_MESSAGE}</dd>
          </div>
        </dl>
      </Card>

      <Card title={`Assigned sensors (${zone.sensors.length})`}>
        {zone.sensors.length === 0 ? (
          <p className="text-sm text-slate-500">No located sensors fall within this zone yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Sensor</th>
                  <th className="px-3 py-2">Distance</th>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {zone.sensors.map((m) => (
                  <tr key={m.deviceId}>
                    <td className="px-3 py-2">
                      <Link href={`/sensors/${m.deviceId}`} className="font-mono text-sky-700 hover:underline">
                        {m.deviceId}
                      </Link>
                      <div className="text-xs text-slate-500">{m.name}</div>
                    </td>
                    <td className="px-3 py-2">{m.distanceMeters.toFixed(1)} m</td>
                    <td className="px-3 py-2">{formatCm(m.cm)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
