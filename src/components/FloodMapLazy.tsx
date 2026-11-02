"use client";

// Client wrapper that defers the Leaflet map to the browser. `ssr:false` with
// next/dynamic is only allowed inside Client Components, so the server page
// imports this instead of using next/dynamic directly.

import dynamic from "next/dynamic";
import type { LiveSnapshotData } from "./FloodMap";

const FloodMap = dynamic(() => import("./FloodMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[440px] w-full place-items-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

export default function FloodMapLazy({ initial }: { initial: LiveSnapshotData }) {
  return <FloodMap initial={initial} />;
}
