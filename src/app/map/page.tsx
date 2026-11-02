import { getLiveSnapshot } from "@/lib/queries";
import { Card } from "@/components/Card";
import FloodMapLazy from "@/components/FloodMapLazy";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const snapshot = await getLiveSnapshot();
  const unlocated = snapshot.sensors.filter((s) => !s.hasLocation);

  // Serialize Date fields so the client map and the /api/v1/live poll share
  // one shape.
  const initial = {
    ...snapshot,
    sensors: snapshot.sensors.map((s) => ({
      ...s,
      status: s.status as string,
      lastSeenAt: s.lastSeenAt ? new Date(s.lastSeenAt).toISOString() : null,
    })),
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Live Flood Map</h1>
        <p className="text-sm text-slate-500">
          Sensor and gateway locations with 50-metre monitoring zones.
        </p>
      </div>

      <Card>
        <FloodMapLazy initial={initial} />
      </Card>

      {unlocated.length > 0 && (
        <Card title="Location unavailable" subtitle="Sensors without a verified GPS location cannot be plotted.">
          <ul className="space-y-1 text-sm text-slate-600">
            {unlocated.map((s) => (
              <li key={s.deviceId}>
                <span className="font-mono">{s.deviceId}</span> — {s.name} — Location
                unavailable until configured.
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
