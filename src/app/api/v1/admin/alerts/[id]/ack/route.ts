// POST /api/v1/admin/alerts/[id]/ack — acknowledge an alert (admin only).
// Public visitors can read alerts but never acknowledge them; enforcement is
// server-side.

import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { getAdminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest();
  if (!admin) return fail(401, "admin_only");

  const { id } = await params;
  const alertId = Number.parseInt(id, 10);
  if (!Number.isFinite(alertId)) return fail(422, "invalid_id");

  const existing = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!existing) return fail(404, "alert_not_found");

  const updated = await prisma.alert.update({
    where: { id: alertId },
    data: { acknowledged: true, acknowledgedAt: new Date() },
  });
  return ok({ ok: true, alert_id: updated.id, acknowledged: updated.acknowledged });
}
