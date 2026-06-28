import { redirect } from "next/navigation";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function HearingAgendaAlias() {
  await requirePermission(PERMISSIONS.hearingsAgenda);
  redirect("/admin/audiencias");
}
