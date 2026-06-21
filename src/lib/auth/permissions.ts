import "server-only";

import { redirect } from "next/navigation";
import { requireInternalUser } from "@/lib/auth/authorization";
import {
  defaultRoleCan,
  type PermissionAction,
  type PermissionResource,
} from "@/lib/permissions/catalog";
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

export const PERMISSIONS = {
  casesCreate: { resource: "expedientes", action: "create" },
  casesEdit: { resource: "expedientes", action: "edit" },
  casesRepartition: { resource: "expedientes", action: "repartition" },
  casesAssignPonente: { resource: "expedientes", action: "assign_ponente" },
  actionsCreate: { resource: "actuaciones", action: "create" },
  hearingsView: { resource: "audiencias", action: "view" },
  hearingsCreate: { resource: "audiencias", action: "create" },
  hearingsEdit: { resource: "audiencias", action: "edit" },
  hearingsReschedule: { resource: "audiencias", action: "reschedule" },
  hearingsCancel: { resource: "audiencias", action: "cancel" },
  minutesCreate: { resource: "actas", action: "create" },
  minutesEdit: { resource: "actas", action: "edit" },
  minutesFinalize: { resource: "actas", action: "finalize" },
  minutesReopen: { resource: "actas", action: "reopen" },
  minutesSign: { resource: "actas", action: "sign" },
  minutesPrint: { resource: "actas", action: "print" },
  proceedingsCreate: { resource: "providencias", action: "create" },
  proceedingsEdit: { resource: "providencias", action: "edit" },
  proceedingsPublish: { resource: "providencias", action: "publish" },
  proceedingsSign: { resource: "providencias", action: "sign" },
  proceedingsPrint: { resource: "providencias", action: "print" },
  documentsUpload: { resource: "documentos", action: "upload" },
  documentsPreview: { resource: "documentos", action: "preview" },
  documentsDownload: { resource: "documentos", action: "download" },
  noticesCreate: { resource: "comunicados", action: "create" },
  noticesEdit: { resource: "comunicados", action: "edit" },
  noticesPublish: { resource: "comunicados", action: "publish" },
  statesCreate: { resource: "estados", action: "create" },
  statesEdit: { resource: "estados", action: "edit" },
  statesPublish: { resource: "estados", action: "publish" },
  linksCreate: { resource: "enlaces", action: "create" },
  linksRevoke: { resource: "enlaces", action: "revoke" },
  signaturesSign: { resource: "firmas", action: "sign" },
  signaturesRequest: { resource: "firmas", action: "request" },
  signaturesRevoke: { resource: "firmas", action: "revoke" },
  usersCreate: { resource: "usuarios", action: "create" },
  usersEdit: { resource: "usuarios", action: "edit" },
  usersDeactivate: { resource: "usuarios", action: "deactivate" },
  usersReactivate: { resource: "usuarios", action: "reactivate" },
  usersAssignRole: { resource: "usuarios", action: "assign_role" },
  usersCreateInInstitution: { resource: "usuarios", action: "create_in_institution" },
  usersCreateInDependency: { resource: "usuarios", action: "create_in_dependency" },
  usersAssignDependency: { resource: "usuarios", action: "assign_dependency" },
  usersViewAll: { resource: "usuarios", action: "view_all" },
  usersViewDependency: { resource: "usuarios", action: "view_dependency" },
  auditView: { resource: "auditoria", action: "view" },
  auditExport: { resource: "auditoria", action: "export" },
  institutionsView: { resource: "instituciones", action: "view" },
  institutionsManage: { resource: "instituciones", action: "manage" },
  dependenciesView: { resource: "dependencias", action: "view" },
  dependenciesManage: { resource: "dependencias", action: "manage" },
  rolesManage: { resource: "roles", action: "manage" },
  settingsManage: { resource: "configuracion", action: "manage" },
  editTakeControl: { resource: "edicion", action: "take_control" },
  votesView: { resource: "votos", action: "view" },
  votesCreate: { resource: "votos", action: "create" },
  votesEdit: { resource: "votos", action: "edit" },
  votesSign: { resource: "votos", action: "sign" },
  votesPublish: { resource: "votos", action: "publish" },
  salaView: { resource: "sala", action: "view" },
  salaSend: { resource: "sala", action: "send" },
  salaRegisterSession: { resource: "sala", action: "register_session" },
  salaRegisterVote: { resource: "sala", action: "register_vote" },
  salaApprove: { resource: "sala", action: "approve" },
  salaReturn: { resource: "sala", action: "return" },
  salaPublish: { resource: "sala", action: "publish" },
  notificationsView: { resource: "notificaciones", action: "view" },
  notificationsManage: { resource: "notificaciones", action: "manage" },
} as const satisfies Record<string, PermissionRequirement>;

export type PermissionRequirement = {
  resource: PermissionResource;
  action: PermissionAction;
};

type PermissionContext = {
  supabase: Awaited<ReturnType<typeof requireInternalUser>>["supabase"];
};

function isPermissionRequirement(
  value: readonly AppRole[] | PermissionRequirement,
): value is PermissionRequirement {
  return !Array.isArray(value) && "resource" in value && "action" in value;
}

export async function can(
  profile: { id: string; is_owner: boolean; role: AppRole },
  action: PermissionAction,
  resource: PermissionResource,
  context: PermissionContext,
) {
  if (profile.is_owner && profile.role === "SUPER_ADMIN") return true;

  const [{ data: override, error: overrideError }, { data: roleRule, error: roleError }] =
    await Promise.all([
      context.supabase
        .from("user_permission_overrides")
        .select("effect")
        .eq("user_id", profile.id)
        .eq("resource", resource)
        .eq("action", action)
        .maybeSingle(),
      context.supabase
        .from("role_permission_rules")
        .select("allowed")
        .eq("role", profile.role)
        .eq("resource", resource)
        .eq("action", action)
        .maybeSingle(),
    ]);

  if (!overrideError && override?.effect === "deny") return false;
  if (!overrideError && override?.effect === "allow") return true;
  if (!roleError && typeof roleRule?.allowed === "boolean") return roleRule.allowed;
  return defaultRoleCan(profile.role, resource, action);
}

export async function requirePermission(allowed: readonly AppRole[] | PermissionRequirement) {
  const session = await requireInternalUser();
  const requirement = isPermissionRequirement(allowed) ? allowed : null;
  const granted = requirement
    ? await can(session.profile, requirement.action, requirement.resource, { supabase: session.supabase })
    : session.profile.is_owner || (allowed as readonly AppRole[]).includes(session.profile.role);
  if (!granted) {
    await session.supabase.rpc("log_security_event", {
      p_action: "PERMISSION_DENIED",
      p_table: requirement?.resource ?? "authorization",
      p_record_id: null,
      p_description: "Intento de operación sin permiso efectivo",
      p_metadata: requirement ?? { role: session.profile.role },
    });
    redirect("/no-autorizado");
  }
  return session;
}

export async function enforcePermission(
  session: Awaited<ReturnType<typeof requireInternalUser>>,
  requirement: PermissionRequirement,
  recordId: string | null = null,
) {
  const granted = await can(
    session.profile,
    requirement.action,
    requirement.resource,
    { supabase: session.supabase },
  );
  if (!granted) {
    await session.supabase.rpc("log_security_event", {
      p_action: "PERMISSION_DENIED",
      p_table: requirement.resource,
      p_record_id: recordId,
      p_description: "Intento de operación sin permiso efectivo",
      p_metadata: requirement,
    });
    redirect("/no-autorizado");
  }
  return session;
}

export async function requireOwnerPermission(requirement: PermissionRequirement) {
  const session = await requirePermission(requirement);
  if (!session.profile.is_owner || session.profile.role !== "SUPER_ADMIN") {
    await session.supabase.rpc("log_security_event", {
      p_action: "OWNER_PROTECTION_DENIED",
      p_table: requirement.resource,
      p_record_id: null,
      p_description: "Se impidió una operación reservada a la cuenta propietaria",
      p_metadata: requirement,
    });
    redirect("/no-autorizado");
  }
  return session;
}

export function hasPermission(profile: { is_owner: boolean; role: AppRole }, allowed: readonly AppRole[]) {
  return profile.is_owner || allowed.includes(profile.role);
}

export async function requireCaseAccess(caseId: string, allowed: readonly AppRole[] | PermissionRequirement) {
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
