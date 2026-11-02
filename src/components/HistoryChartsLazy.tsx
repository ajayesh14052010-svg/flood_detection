"use client";

// Client wrapper that defers the Recharts history charts to the browser.

import dynamic from "next/dynamic";
import type { ChartPoint } from "./HistoryCharts";

const HistoryCharts = dynamic(() => import("./HistoryCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid h-64 w-full place-items-center rounded-lg bg-slate-50 text-sm text-slate-500">
      Loading chart…
    </div>
  ),
});

export default function HistoryChartsLazy({
  data,
  calibrated,
  hasFlow,
}: {
  data: ChartPoint[];
  calibrated: boolean;
  hasFlow: boolean;
}) {
  return <HistoryCharts data={data} calibrated={calibrated} hasFlow={hasFlow} />;
}
