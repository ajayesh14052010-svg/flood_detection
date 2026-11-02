import Link from "next/link";
import { listSensors } from "@/lib/queries";
import StatusBadge from "@/components/StatusBadge";
import { formatCm, locationLabel, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SensorsPage() {
  const sensors = await listSensors();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sensors</h1>
        <p className="text-sm text-slate-500">
          {sensors.length} registered sensor{sensors.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Sensor</th>
                <th className="px-4 py-2">Gateway</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Level</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Last update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sensors.map((s) => (
                <tr key={s.deviceId} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/sensors/${s.deviceId}`} className="font-mono text-sky-700 hover:underline">
                      {s.deviceId}
                    </Link>
                    <div className="text-xs text-slate-500">{s.name}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{s.gatewayId ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={s.effectiveStatus} simulated={s.latest.simulated} />
                  </td>
                  <td className="px-4 py-2">{formatCm(s.latest.calibratedWaterLevelCm)}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {locationLabel(s.hasLocation, s.latitude, s.longitude)}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {s.isOffline ? "offline" : formatTime(s.latest.receivedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
