"use client";

// Historical charts for a sensor. Water level (cm) and, only when real flow
// data exists, flow (L/min). Raw-only / uncalibrated sensors render the raw
// series instead — never a fake cm line.

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export interface ChartPoint {
  t: string; // ISO timestamp
  raw: number;
  cm: number | null;
  flow: number | null;
}

export default function HistoryCharts({
  data,
  calibrated,
  hasFlow,
}: {
  data: ChartPoint[];
  calibrated: boolean;
  hasFlow: boolean;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No historical readings yet.</p>;
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-700">
          {calibrated ? "Water level (calibrated cm)" : "Raw sensor reading (uncalibrated)"}
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="t" tickFormatter={fmtTime} fontSize={11} minTickGap={24} />
              <YAxis fontSize={11} />
              <Tooltip
                labelFormatter={(v) => new Date(String(v)).toLocaleString()}
                formatter={(val: number | string, name: string) => [
                  name === "cm" ? `${val} cm` : name === "raw" ? `${val}` : val,
                  name === "cm" ? "Level (cm)" : name === "raw" ? "Raw" : String(name),
                ]}
              />
              {calibrated ? (
                <Line type="monotone" dataKey="cm" stroke="#0284c7" strokeWidth={2} dot={false} />
              ) : (
                <Line type="monotone" dataKey="raw" stroke="#94a3b8" strokeWidth={2} dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {hasFlow && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Water flow (L/min)</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="t" tickFormatter={fmtTime} fontSize={11} minTickGap={24} />
                <YAxis fontSize={11} />
                <Tooltip labelFormatter={(v) => new Date(String(v)).toLocaleString()} formatter={(v: number) => [`${v} L/min`, "Flow"]} />
                <Legend />
                <Line type="monotone" dataKey="flow" name="Flow" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
