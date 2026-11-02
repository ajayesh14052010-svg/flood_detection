import Link from "next/link";
import { getZones } from "@/lib/queries";
import StatusBadge from "@/components/StatusBadge";
import { Card } from "@/components/Card";
import { formatCm, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  const zones = await getZones();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Monitoring Zones</h1>
        <p className="text-sm text-slate-500">
          50-metre monitoring circles. These are <strong>not</strong> official government
          wards or administrative boundaries.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {zones.map((z) => (
          <Card key={z.zoneId}>
            <div className="flex items-start justify-between">
              <div>
                <Link href={`/zones/${z.zoneId}`} className="font-mono font-semibold text-sky-700 hover:underline">
                  {z.zoneId}
                </Link>
                <p className="text-xs text-slate-500">{z.name}</p>
              </div>
              {z.highestSeverity && <StatusBadge status={z.highestSeverity} />}
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Radius</dt>
                <dd>{z.radiusMeters} m</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Centre</dt>
                <dd className="font-mono text-xs">
                  {z.centerLat.toFixed(5)}, {z.centerLng.toFixed(5)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Sensors</dt>
                <dd>{z.sensors.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Highest level</dt>
                <dd>{formatCm(z.latestLevelCm)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Last update</dt>
                <dd>{formatTime(z.lastUpdate)}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}
