"use client";

// Interactive flood map using Leaflet + OpenStreetMap. Draws the 50 m monitoring
// zones as circles and plots sensors / the gateway as coloured markers by live
// status. Polls /api/v1/live for near-real-time updates. Uses CircleMarker (no
// icon image assets) to avoid bundler asset issues.

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Popup,
  Tooltip,
} from "react-leaflet";
import { statusColor } from "@/lib/format";

interface SnapshotSensor {
  deviceId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  hasLocation: boolean;
  status: string;
  cm: number | null;
  simulated: boolean;
  lastSeenAt: string | null;
}
interface SnapshotZone {
  zoneId: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}
interface SnapshotGateway {
  gatewayId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  isOnline: boolean;
  status: string;
}
export interface LiveSnapshotData {
  sensors: SnapshotSensor[];
  zones: SnapshotZone[];
  gateways: SnapshotGateway[];
}

const DEFAULT_CENTER: [number, number] = [13.0827, 80.27];

export default function FloodMap({ initial }: { initial: LiveSnapshotData }) {
  const [data, setData] = useState<LiveSnapshotData>(initial);
  const [updated, setUpdated] = useState<string>(() => new Date().toLocaleTimeString());

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/v1/live");
        if (!res.ok) return;
        const json = (await res.json()) as LiveSnapshotData;
        if (active) {
          setData(json);
          setUpdated(new Date().toLocaleTimeString());
        }
      } catch {
        /* transient network error — keep last snapshot */
      }
    };
    const id = setInterval(tick, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const center = useMemo<[number, number]>(() => {
    const s = data.sensors.find((x) => x.hasLocation && x.latitude != null);
    if (s && s.latitude != null && s.longitude != null) return [s.latitude, s.longitude];
    const z = data.zones[0];
    if (z) return [z.centerLat, z.centerLng];
    return DEFAULT_CENTER;
  }, [data]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>Auto-refreshes every 15s · updated {updated}</span>
        <span className="hidden sm:inline">
          Circles are 50 m monitoring zones (not admin wards).
        </span>
      </div>
      <div className="h-[440px] w-full overflow-hidden rounded-xl border border-slate-200">
        <MapContainer center={center} zoom={15} scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {data.zones.map((z) => (
            <Circle
              key={z.zoneId}
              center={[z.centerLat, z.centerLng]}
              radius={z.radiusMeters}
              pathOptions={{ color: "#0284c7", fillColor: "#38bdf8", fillOpacity: 0.12, weight: 1.5 }}
            >
              <Tooltip>{z.zoneId} ({z.radiusMeters} m)</Tooltip>
            </Circle>
          ))}

          {data.gateways.map((g) =>
            g.latitude != null && g.longitude != null ? (
              <CircleMarker
                key={g.gatewayId}
                center={[g.latitude, g.longitude]}
                radius={9}
                pathOptions={{ color: "#0f172a", fillColor: g.isOnline ? "#0ea5e9" : "#64748b", fillOpacity: 0.9 }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{g.gatewayId}</strong>
                    <br />
                    {g.name}
                    <br />
                    Status: {g.isOnline ? "Online" : "Offline"}
                    <br />
                    <em>Gateway coordinates (from onboard GPS) — not a sensor location.</em>
                  </div>
                </Popup>
              </CircleMarker>
            ) : null
          )}

          {data.sensors.map((s) =>
            s.hasLocation && s.latitude != null && s.longitude != null ? (
              <CircleMarker
                key={s.deviceId}
                center={[s.latitude, s.longitude]}
                radius={7}
                pathOptions={{ color: "#fff", weight: 1.5, fillColor: statusColor(s.status), fillOpacity: 0.95 }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{s.deviceId}</strong>
                    {s.simulated ? " · SIMULATED" : ""}
                    <br />
                    {s.name}
                    <br />
                    Level: {s.cm != null ? `${s.cm.toFixed(1)} cm` : "calibration required"}
                    <br />
                    Status: {s.status}
                    <br />
                    <span className="text-xs">Last seen: {s.lastSeenAt ?? "—"}</span>
                  </div>
                </Popup>
              </CircleMarker>
            ) : null
          )}
        </MapContainer>
      </div>
    </div>
  );
}
