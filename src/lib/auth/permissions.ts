import "server-only";

import { redirect } from "next/navigation";
import { requireInternalUser } from "@/lib/auth/authorization";
import type { AppRole } from "@/lib/user-management";

export const RESOURCE_ROLES = {
  casesCreate: ["RADICADOR", "SECRETARIO_GENERAL"] as AppRole[],
  casesEdit: ["ADMIN_INSTITUCIONAL", "RADICADOR", "REPARTO", "SECRETARIO_GENERAL", "SECRETARIO_DESPACHO"] as AppRole[],
  actionsWrite: ["MAGISTRADO_CORTE_SUPREMA", "MAGISTRADO_TRIBUNAL", "JUEZ_CIRCUITO", "JUEZ_MUNICIPAL", "SECRETARIO_GENERAL", "SECRETARIO_DESPACHO", "OFICIAL_MAYOR"] as AppRole[],
  hearingsWrite: ["MAGISTRADO_CORTE_SUPREMA", "MAGISTRADO_TRIBUNAL", "JUEZ_CIRCUITO", "JUEZ_MUNICIPAL", "SECRETARIO_GENERAL", "SECRETARIO_DESPACHO"] as AppRole[],
  proceedingsWrite: ["MAGISTRADO_CORTE_SUPREMA", "MAGISTRADO_TRIBUNAL", "JUEZ_CIRCUITO", "JUEZ_MUNICIPAL", "SECRETARIO_DESPACHO", "OFICIAL_MAYOR"] as AppRole[],
  secretarialWrite: ["SECRETARIO_GENERAL", "SECRETARIO_DESPACHO"] as AppRole[],
  noticesWrite: ["SECRETARIO_GENERAL", "GOBERNACION_COMUNICACIONES"] as AppRole[],
  archive: ["ARCHIVO"] as AppRole[],
  dependenciesWrite: ["SUPER_ADMIN"] as AppRole[],
} as const;

export async function requirePermission(allowed: readonly AppRole[]) {
  const session = await requireInternalUser();
  if (!session.profile.is_owner && !allowed.includes(session.profile.role)) redirect("/no-autorizado");
  return session;
}

export function hasPermission(profile: { is_owner: boolean; role: AppRole }, allowed: readonly AppRole[]) {
  return profile.is_owner || allowed.includes(profile.role);
}

export async function requireCaseAccess(caseId: string, allowed: readonly AppRole[]) {
  const session = await requirePermission(allowed);
  const { data: record } = await session.supabase
    .from("cases")
    .select("id,dependency_id,assigned_judge_id,archived_at")
    .eq("id", caseId)
    .maybeSingle();
  if (!record) redirect("/admin/expedientes?error=Expediente%20no%20encontrado%20o%20sin%20acceso");
  if (!session.profile.is_owner && session.profile.role === "ADMIN_INSTITUCIONAL" && record.dependency_id !== session.profile.dependency_id) redirect("/no-autorizado");
  if (!session.profile.is_owner && ["MAGISTRADO_CORTE_SUPREMA", "MAGISTRADO_TRIBUNAL", "JUEZ_CIRCUITO", "JUEZ_MUNICIPAL"].includes(session.profile.role) && record.assigned_judge_id !== session.user.id) redirect("/no-autorizado");
  return { ...session, record };
}
