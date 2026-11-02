import Link from "next/link";
import { notFound } from "next/navigation";
import { getSensorDetail } from "@/lib/queries";
import StatusBadge from "@/components/StatusBadge";
import { Card } from "@/components/Card";
import HistoryChartsLazy from "@/components/HistoryChartsLazy";
import { formatCm, locationLabel, formatTime } from "@/lib/format";
import { CALIBRATION_REQUIRED_MESSAGE, FLOW_UNAVAILABLE_MESSAGE } from "@/lib/types";
import type { ChartPoint } from "@/components/HistoryCharts";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

export default async function SensorDetailPage({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await params;
  const { sensor, history, zones } = await getSensorDetail(decodeURIComponent(deviceId));
  if (!sensor) notFound();

  const data: ChartPoint[] = history.map((h) => ({
    t: new Date(h.t).toISOString(),
    raw: h.raw,
    cm: h.cm,
    flow: h.flow,
  }));

  const flowText = sensor.latest.flowAvailable
    ? `${sensor.latest.waterFlowLpm?.toFixed(1)} L/min${sensor.latest.flowEstimated ? " (estimated)" : ""}`
    : FLOW_UNAVAILABLE_MESSAGE;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-mono text-2xl font-bold text-slate-900">{sensor.deviceId}</h1>
          <p className="text-sm text-slate-500">{sensor.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={sensor.effectiveStatus} simulated={sensor.latest.simulated} />
          <Link href="/sensors" className="text-sm text-sky-600 hover:underline">
            ← all sensors
          </Link>
        </div>
      </div>

      {sensor.latest.simulated && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This is SIMULATED demo data, not an actual flood measurement.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Current reading">
          <Row label="Raw sensor value" value={sensor.latest.rawSensorValue ?? "—"} />
          <Row
            label="Calibrated water level"
            value={
              sensor.calibrationConfigured
                ? formatCm(sensor.latest.calibratedWaterLevelCm)
                : CALIBRATION_REQUIRED_MESSAGE
            }
          />
          <Row label="Water flow" value={flowText} />
          <Row label="Last communication" value={sensor.isOffline ? "offline" : formatTime(sensor.latest.receivedAt)} />
          <Row label="Data quality" value={sensor.latest.dataQuality ?? "—"} />
        </Card>

        <Card title="Device & signal">
          <Row label="Gateway" value={sensor.gatewayId ?? "—"} />
          <Row label="Calibration" value={sensor.calibrationConfigured ? "Configured" : "Required"} />
          <Row label="LoRa RSSI" value={sensor.latest.loraRssi != null ? `${sensor.latest.loraRssi} dBm` : "—"} />
          <Row label="LoRa SNR" value={sensor.latest.loraSnr != null ? `${sensor.latest.loraSnr} dB` : "—"} />
          <Row label="Battery" value={sensor.latest.batteryVoltage != null ? `${sensor.latest.batteryVoltage} V` : "Not reported"} />
          <Row label="Packet #" value={sensor.latest.packetSequence ?? "—"} />
          <Row label="Location" value={locationLabel(sensor.hasLocation, sensor.latitude, sensor.longitude)} />
          <Row label="Zones" value={zones.length ? zones.join(", ") : "none"} />
        </Card>
      </div>

      <Card
        title="History"
        subtitle={`${history.length} readings`}
      >
        <div className="mb-3 -mt-1 flex justify-end">
          <a
            href={`/api/v1/sensors/${encodeURIComponent(sensor.deviceId)}/history`}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Export history (CSV)
          </a>
        </div>
        <HistoryChartsLazy data={data} calibrated={sensor.calibrationConfigured} hasFlow={data.some((d) => d.flow != null)} />
      </Card>
    </div>
  );
}
