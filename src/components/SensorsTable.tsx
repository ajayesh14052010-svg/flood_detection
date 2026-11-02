"use client";

// Client-side sensor table with text search and status filtering. The server
// page supplies already-computed rows (DB-derived status), so this component
// only handles interaction — no data is hardcoded here.

import { useMemo, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { formatCm, locationLabel } from "@/lib/format";

export interface SensorRow {
  deviceId: string;
  name: string;
  gatewayId: string | null;
  status: string;
  simulated: boolean;
  cm: number | null;
  hasLocation: boolean;
  latitude: number | null;
  longitude: number | null;
  lastSeen: string;
  offline: boolean;
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "NORMAL", label: "Normal" },
  { value: "WATCH", label: "Watch" },
  { value: "WARNING", label: "Warning" },
  { value: "CRITICAL", label: "Critical" },
  { value: "DATA_STALE", label: "Data stale" },
  { value: "SENSOR_OFFLINE", label: "Sensor offline" },
  { value: "CALIBRATION_REQUIRED", label: "Calibration required" },
];

export default function SensorsTable({ rows }: { rows: SensorRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (!needle) return true;
      return (
        r.deviceId.toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle) ||
        (r.gatewayId ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, q, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by sensor ID, name or gateway…"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          {filtered.length} of {rows.length}
        </span>
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
              {filtered.map((s) => (
                <tr key={s.deviceId} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/sensors/${s.deviceId}`} className="font-mono text-sky-700 hover:underline">
                      {s.deviceId}
                    </Link>
                    <div className="text-xs text-slate-500">{s.name}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{s.gatewayId ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={s.status} simulated={s.simulated} />
                  </td>
                  <td className="px-4 py-2">{formatCm(s.cm)}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {locationLabel(s.hasLocation, s.latitude, s.longitude)}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {s.offline ? "offline" : s.lastSeen}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    No sensors match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
