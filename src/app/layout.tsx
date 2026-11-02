import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "FloodGuard — IoT Flood Monitoring & Community Alerts",
  description:
    "Public dashboard for real-time water-level monitoring, 50-metre monitoring zones, device diagnostics, and flood alerts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-slate-500">
          <p className="mb-1 font-semibold text-slate-600">Important notes</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              The circles on the map are <strong>50-metre monitoring zones</strong> set
              around sensor points. They are <strong>not</strong> official government
              wards or administrative boundaries.
            </li>
            <li>
              Raw sensor values are not centimetres. Water levels in cm appear only
              after an administrator configures and validates a calibration.
            </li>
            <li>
              Water-flow (L/min) is shown only when a real flow sensor or a validated
              model provides it. FloodGuard never invents flow data.
            </li>
            <li>
              Readings labelled <strong>SIMULATED</strong> are demo data for testing the
              interface before hardware is connected — they are not real measurements.
            </li>
          </ul>
        </footer>
      </body>
    </html>
  );
}
