import { getGatewayDiagnostics } from "@/lib/queries";
import { Card } from "@/components/Card";
import { formatTime } from "@/lib/format";
import { formatAge } from "@/lib/stale";

export const dynamic = "force-dynamic";

// ESP32-2 is identified by its unique gateway id, never its IP address.
const GATEWAY_ID = "FG-GATEWAY-002";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

export default async function DiagnosticsPage() {
  const gw = await getGatewayDiagnostics(GATEWAY_ID);

  if (!gw) {
    return (
      <Card title="Device Diagnostics">
        <p className="text-sm text-slate-500">
          Gateway <span className="font-mono">{GATEWAY_ID}</span> is not registered yet.
          Register it from the admin console.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Device Diagnostics</h1>
        <p className="text-sm text-slate-500">ESP32-2 gateway status and telemetry.</p>
      </div>

      {!gw.isOnline && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          This gateway has not reported recently
          {gw.ageSeconds != null ? ` (last seen ${formatAge(gw.ageSeconds)})` : ""}. Its
          readings may be stale.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Identity & connectivity">
          <Row label="Gateway ID" value={<span className="font-mono">{gw.gatewayId}</span>} />
          <Row label="Name" value={gw.name} />
          <Row
            label="Status"
            value={
              <span className={`badge ${gw.isOnline ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"}`}>
                {gw.status}
              </span>
            }
          />
          <Row label="Last successful communication" value={formatTime(gw.lastSeenAt)} />
          <Row label="Firmware version" value={gw.firmwareVersion ?? "—"} />
          <Row
            label="Latest reported IP"
            value={
              <span>
                <span className="font-mono">{gw.lastReportedIp ?? "—"}</span>
                <div className="text-xs text-amber-600">Diagnostics only — never a login credential.</div>
              </span>
            }
          />
        </Card>

        <Card title="GPS, LoRa & power">
          <Row label="GPS fix" value={gw.gpsFix ? "Locked" : "No fix"} />
          <Row
            label="Gateway coordinates"
            value={
              gw.latitude != null && gw.longitude != null
                ? `${gw.latitude.toFixed(5)}, ${gw.longitude.toFixed(5)}`
                : "Location unavailable"
            }
          />
          <Row label="LoRa RSSI" value={gw.loraRssi != null ? `${gw.loraRssi} dBm` : "—"} />
          <Row label="LoRa SNR" value={gw.loraSnr != null ? `${gw.loraSnr} dB` : "—"} />
          <Row label="Battery voltage" value={gw.batteryVoltage != null ? `${gw.batteryVoltage} V` : "Not reported"} />
          <Row label="Packets received" value={gw.packetsReceived} />
          <Row label="Sensors reporting" value={`${gw.sensorsOnline} / ${gw.sensorsTotal} online`} />
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        Note: the NEO-6M GPS is on the gateway; its coordinates are labelled as gateway
        coordinates and are not assumed to be any remote sensor&apos;s location.
      </p>
    </div>
  );
}
