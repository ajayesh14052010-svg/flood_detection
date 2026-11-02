// PUT /api/v1/admin/thresholds — admin-only flood threshold configuration.
import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { getAdminFromRequest } from "@/lib/auth";
import { setThreshold, getThresholds } from "@/lib/thresholds";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    watch_cm: z.number().positive().optional(),
    warning_cm: z.number().positive().optional(),
    critical_cm: z.number().positive().optional(),
    stale_seconds: z.number().int().positive().optional(),
  })
  .strict();

export async function PUT(req: NextRequest) {
  const admin = await getAdminFromRequest();
  if (!admin) return fail(401, "admin_only");

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(422, "invalid_payload");

  const d = parsed.data;
  if (d.watch_cm != null) await setThreshold("watchCm", d.watch_cm);
  if (d.warning_cm != null) await setThreshold("warningCm", d.warning_cm);
  if (d.critical_cm != null) await setThreshold("criticalCm", d.critical_cm);
  if (d.stale_seconds != null) await setThreshold("staleSeconds", d.stale_seconds);

  const next = await getThresholds();
  if (!(next.watchCm < next.warningCm && next.warningCm < next.criticalCm)) {
    return fail(422, "thresholds_must_increase", { thresholds: next });
  }
  return ok({ ok: true, thresholds: next });
}
