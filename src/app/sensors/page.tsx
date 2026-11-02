import { listSensors } from "@/lib/queries";
import { formatTime } from "@/lib/format";
import SensorsTable, { type SensorRow } from "@/components/SensorsTable";

export const dynamic = "force-dynamic";

export default async function SensorsPage() {
  const sensors = await listSensors();

  const rows: SensorRow[] = sensors.map((s) => ({
    deviceId: s.deviceId,
    name: s.name,
    gatewayId: s.gatewayId,
    status: s.effectiveStatus,
    simulated: s.latest.simulated,
    cm: s.latest.calibratedWaterLevelCm,
    hasLocation: s.hasLocation,
    latitude: s.latitude,
    longitude: s.longitude,
    lastSeen: formatTime(s.latest.receivedAt),
    offline: s.isOffline,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sensors</h1>
        <p className="text-sm text-slate-500">
          {sensors.length} registered sensor{sensors.length === 1 ? "" : "s"}.
        </p>
      </div>

      <SensorsTable rows={rows} />
    </div>
  );
}
