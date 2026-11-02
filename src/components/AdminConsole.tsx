"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SensorLite {
  deviceId: string;
  name: string;
  calibrationConfigured: boolean;
  hasLocation: boolean;
}
interface AlertLite {
  id: number;
  message: string;
  type: string;
  simulated: boolean;
  acknowledged: boolean;
}

async function call(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="mb-0.5 block">{label}</span>
      {children}
    </label>
  );
}
const input =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-sky-500";

export default function AdminConsole({ email }: { email: string }) {
  const router = useRouter();
  const [sensors, setSensors] = useState<SensorLite[]>([]);
  const [alerts, setAlerts] = useState<AlertLite[]>([]);
  const [msg, setMsg] = useState<string>("");

  const [reg, setReg] = useState({ device_id: "", name: "", gateway_id: "FG-GATEWAY-002", latitude: "", longitude: "" });
  const [token, setToken] = useState<string | null>(null);

  const [cal, setCal] = useState({ deviceId: "", configured: true, slope: "0.02", intercept: "0", latitude: "", longitude: "" });
  const [thr, setThr] = useState({ watch_cm: "30", warning_cm: "60", critical_cm: "100", stale_seconds: "900" });
  const [zone, setZone] = useState({ zone_id: "FG-ZONE-004", name: "", center_lat: "13.0827", center_lng: "80.27", radius_meters: "50" });

  const refresh = useCallback(async () => {
    const [s, a] = await Promise.all([
      fetch("/api/v1/sensors").then((r) => r.json()).catch(() => []),
      fetch("/api/v1/alerts").then((r) => r.json()).catch(() => []),
    ]);
    setSensors(
      (Array.isArray(s) ? s : []).map((x: SensorLite) => ({
        deviceId: x.deviceId,
        name: x.name,
        calibrationConfigured: x.calibrationConfigured,
        hasLocation: x.hasLocation,
      }))
    );
    setAlerts(
      (Array.isArray(a) ? a : []).map((x: AlertLite) => ({
        id: x.id,
        message: x.message,
        type: x.type,
        simulated: x.simulated,
        acknowledged: x.acknowledged,
      }))
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function doRegister(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setToken(null);
    const { ok, json } = await call("POST", "/api/v1/admin/devices", {
      device_id: reg.device_id,
      name: reg.name,
      gateway_id: reg.gateway_id || undefined,
      latitude: reg.latitude === "" ? null : Number(reg.latitude),
      longitude: reg.longitude === "" ? null : Number(reg.longitude),
    });
    if (ok) {
      setToken(json.device_token);
      setMsg(`Registered ${json.device_id}. Provision this token to the device now.`);
      refresh();
    } else setMsg(`Registration failed: ${json.error}`);
  }

  async function doCalibration(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const { ok, json } = await call("PUT", `/api/v1/admin/devices/${cal.deviceId}/calibration`, {
      calibration_configured: cal.configured,
      slope: Number(cal.slope),
      intercept: Number(cal.intercept),
      latitude: cal.latitude === "" ? null : Number(cal.latitude),
      longitude: cal.longitude === "" ? null : Number(cal.longitude),
      location_source: cal.latitude !== "" && cal.longitude !== "" ? "MANUAL" : null,
    });
    setMsg(ok ? `Calibration saved for ${cal.deviceId}.` : `Failed: ${json.error}`);
    if (ok) refresh();
  }

  async function doThresholds(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const { ok, json } = await call("PUT", "/api/v1/admin/thresholds", {
      watch_cm: Number(thr.watch_cm),
      warning_cm: Number(thr.warning_cm),
      critical_cm: Number(thr.critical_cm),
      stale_seconds: Number(thr.stale_seconds),
    });
    setMsg(ok ? "Thresholds updated." : `Failed: ${json.error ?? JSON.stringify(json)}`);
  }

  async function doZone(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const { ok, json } = await call("POST", "/api/v1/admin/zones", {
      zone_id: zone.zone_id,
      name: zone.name || zone.zone_id,
      center_lat: Number(zone.center_lat),
      center_lng: Number(zone.center_lng),
      radius_meters: Number(zone.radius_meters),
    });
    setMsg(ok ? `Zone created; assigned ${json.assigned_devices?.length ?? 0} sensor(s).` : `Failed: ${json.error}`);
  }

  async function ack(id: number) {
    const { ok } = await call("POST", `/api/v1/admin/alerts/${id}/ack`);
    if (ok) refresh();
  }

  async function logout() {
    await call("POST", "/api/v1/admin/logout");
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Admin Console</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{email}</span>
          <button onClick={logout} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
            Sign out
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          {msg}
          {token && (
            <div className="mt-2 break-all rounded bg-amber-50 p-2 font-mono text-xs text-amber-900">
              DEVICE TOKEN (shown once): {token}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Register device */}
        <form onSubmit={doRegister} className="card space-y-2 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Register sensor</h2>
          <Field label="Device ID"><input className={input} value={reg.device_id} onChange={(e) => setReg({ ...reg, device_id: e.target.value })} placeholder="FG-SENSOR-007" required /></Field>
          <Field label="Name"><input className={input} value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} required /></Field>
          <Field label="Gateway ID"><input className={input} value={reg.gateway_id} onChange={(e) => setReg({ ...reg, gateway_id: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Latitude"><input className={input} value={reg.latitude} onChange={(e) => setReg({ ...reg, latitude: e.target.value })} placeholder="optional" /></Field>
            <Field label="Longitude"><input className={input} value={reg.longitude} onChange={(e) => setReg({ ...reg, longitude: e.target.value })} placeholder="optional" /></Field>
          </div>
          <button className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700">Register</button>
        </form>

        {/* Calibration */}
        <form onSubmit={doCalibration} className="card space-y-2 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Calibration & location</h2>
          <Field label="Sensor">
            <select className={input} value={cal.deviceId} onChange={(e) => setCal({ ...cal, deviceId: e.target.value })} required>
              <option value="">Select…</option>
              {sensors.map((s) => (
                <option key={s.deviceId} value={s.deviceId}>{s.deviceId} ({s.name})</option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={cal.configured} onChange={(e) => setCal({ ...cal, configured: e.target.checked })} />
            Calibration configured
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Slope (cm per raw)"><input className={input} value={cal.slope} onChange={(e) => setCal({ ...cal, slope: e.target.value })} /></Field>
            <Field label="Intercept"><input className={input} value={cal.intercept} onChange={(e) => setCal({ ...cal, intercept: e.target.value })} /></Field>
            <Field label="Latitude"><input className={input} value={cal.latitude} onChange={(e) => setCal({ ...cal, latitude: e.target.value })} /></Field>
            <Field label="Longitude"><input className={input} value={cal.longitude} onChange={(e) => setCal({ ...cal, longitude: e.target.value })} /></Field>
          </div>
          <button className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700">Save</button>
        </form>

        {/* Thresholds */}
        <form onSubmit={doThresholds} className="card space-y-2 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Flood thresholds (cm)</h2>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Watch cm"><input className={input} value={thr.watch_cm} onChange={(e) => setThr({ ...thr, watch_cm: e.target.value })} /></Field>
            <Field label="Warning cm"><input className={input} value={thr.warning_cm} onChange={(e) => setThr({ ...thr, warning_cm: e.target.value })} /></Field>
            <Field label="Critical cm"><input className={input} value={thr.critical_cm} onChange={(e) => setThr({ ...thr, critical_cm: e.target.value })} /></Field>
            <Field label="Stale seconds"><input className={input} value={thr.stale_seconds} onChange={(e) => setThr({ ...thr, stale_seconds: e.target.value })} /></Field>
          </div>
          <button className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700">Update thresholds</button>
        </form>

        {/* Zone */}
        <form onSubmit={doZone} className="card space-y-2 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Create monitoring zone</h2>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Zone ID"><input className={input} value={zone.zone_id} onChange={(e) => setZone({ ...zone, zone_id: e.target.value })} /></Field>
            <Field label="Name"><input className={input} value={zone.name} onChange={(e) => setZone({ ...zone, name: e.target.value })} placeholder="optional" /></Field>
            <Field label="Centre lat"><input className={input} value={zone.center_lat} onChange={(e) => setZone({ ...zone, center_lat: e.target.value })} /></Field>
            <Field label="Centre lng"><input className={input} value={zone.center_lng} onChange={(e) => setZone({ ...zone, center_lng: e.target.value })} /></Field>
            <Field label="Radius (m)"><input className={input} value={zone.radius_meters} onChange={(e) => setZone({ ...zone, radius_meters: e.target.value })} /></Field>
          </div>
          <button className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700">Create zone</button>
        </form>
      </div>

      {/* Alerts to acknowledge */}
      <div className="card p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Alerts ({alerts.filter((a) => !a.acknowledged).length} unacknowledged)</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">No alerts.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex-1">{a.message}</span>
                {a.acknowledged ? (
                  <span className="text-xs text-green-700">Acked</span>
                ) : (
                  <button onClick={() => ack(a.id)} className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50">
                    Acknowledge
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
