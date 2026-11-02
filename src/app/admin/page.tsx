import { redirect } from "next/navigation";
import { getAdminFromRequest } from "@/lib/auth";
import AdminConsole from "@/components/AdminConsole";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Server-side gate. Even without this, every admin mutation route re-checks
  // the session — hiding the page is convenience, not the security boundary.
  const admin = await getAdminFromRequest();
  if (!admin) redirect("/admin/login");
  return <AdminConsole email={admin.email} />;
}
