"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enforcePermission, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_ROLES, type AppRole } from "@/lib/user-management";
import { dbUuid } from "@/lib/validation";
import { appUrl } from "@/lib/secure-tokens";

const optionalUuid = dbUuid.optional().or(z.literal(""));
const inviteSchema = z.object({
  email: z.string().trim().email(), full_name: z.string().trim().min(3).max(140), role: z.enum(APP_ROLES),
  institution_id: optionalUuid, dependency_id: optionalUuid, supervisor_id: optionalUuid,
  position_title: z.string().trim().max(120).optional(), creation_method: z.literal("temporary_password"),
  temporary_password: z.string().min(8), is_active: z.enum(["true", "false"]), public_profile: z.string().optional(), is_dependency_leader: z.string().optional(),
});
const updateSchema = z.object({
  target_id: dbUuid, full_name: z.string().trim().min(3).max(140), role: z.enum(APP_ROLES),
  institution_id: optionalUuid, dependency_id: optionalUuid, supervisor_id: optionalUuid,
  position_title: z.string().trim().max(120).optional(), is_active: z.enum(["true", "false"]), public_profile: z.string().optional(), is_dependency_leader: z.string().optional(),
});
const targetSchema = z.object({ target_id: dbUuid });
type Dependency = { id: string; parent_id: string | null; is_active: boolean };

function usersRedirect(kind: "error" | "success", message: string, path = "/admin/usuarios"): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}
function passwordRedirectUrl() { return appUrl("/auth/callback?next=/actualizar-password"); }
function rootOf(id: string | null, dependencies: Dependency[]) {
  if (!id) return null;
  const byId = new Map(dependencies.map((item) => [item.id, item]));
  let current = byId.get(id); let root = current?.id ?? null; const seen = new Set<string>();
  while (current?.parent_id && !seen.has(current.id)) { seen.add(current.id); current = byId.get(current.parent_id); root = current?.id ?? root; }
  return root;
}
function isWithin(child: string | null, parent: string | null, dependencies: Dependency[]) {
  if (!child || !parent) return false;
  const byId = new Map(dependencies.map((item) => [item.id, item])); let current = byId.get(child); const seen = new Set<string>();
  while (current && !seen.has(current.id)) { if (current.id === parent) return true; seen.add(current.id); current = current.parent_id ? byId.get(current.parent_id) : undefined; }
  return false;
}
async function scopeDenied(session: Awaited<ReturnType<typeof requirePermission>>, message: string, targetId?: string): Promise<never> {
  await session.supabase.rpc("log_security_event", { p_action: "USER_CREATION_SCOPE_DENIED", p_table: "profiles", p_record_id: targetId || null, p_description: message, p_metadata: { actor_dependency: session.profile.dependency_id, actor_institution: session.profile.institution_id } });
  usersRedirect("error", message);
}

async function assertManagementScope(
  session: Awaited<ReturnType<typeof requirePermission>>,
  target: { role: AppRole; institution_id?: string | null; dependency_id?: string | null; supervisor_id?: string | null },
  targetId?: string,
) {
  const admin = createAdminClient();
  if (!admin) usersRedirect("error", "Falta SUPABASE_SERVICE_ROLE_KEY");
  const { data: dependencies } = await admin.from("dependencies").select("id,parent_id,is_active");
  const tree = (dependencies ?? []) as Dependency[];
  const dependency = target.dependency_id ? tree.find((item) => item.id === target.dependency_id && item.is_active) : null;
  const institution = target.institution_id ? tree.find((item) => item.id === target.institution_id && item.is_active) : null;
  if (target.dependency_id && !dependency) usersRedirect("error", "La dependencia seleccionada no está disponible");
  if (target.institution_id && !institution) usersRedirect("error", "La institución seleccionada no está disponible");
  const targetInstitution = target.institution_id || rootOf(target.dependency_id ?? null, tree);
  if (target.dependency_id && targetInstitution && !isWithin(target.dependency_id, targetInstitution, tree)) usersRedirect("error", "La dependencia no pertenece a la institución seleccionada");
  if (target.supervisor_id) {
    const { data: supervisor } = await admin.from("profiles").select("id,dependency_id,is_active").eq("id", target.supervisor_id).maybeSingle();
    if (!supervisor?.is_active || (target.dependency_id && supervisor.dependency_id !== target.dependency_id)) usersRedirect("error", "El superior debe estar activo y pertenecer al mismo despacho");
  }
  const actor = session.profile;
  if (actor.is_owner && actor.role === "SUPER_ADMIN") return { admin, institutionId: targetInstitution };
  if (target.role === "SUPER_ADMIN") await scopeDenied(session, "Solo la cuenta propietaria puede asignar SUPER_ADMIN", targetId);
  const actorInstitution = actor.institution_id || rootOf(actor.dependency_id, tree);
  if (actor.role === "ADMIN_INSTITUCIONAL") {
    if (!targetId) await enforcePermission(session, PERMISSIONS.usersCreateInInstitution);
    if (!actorInstitution || !targetInstitution || !isWithin(target.dependency_id || targetInstitution, actorInstitution, tree)) await scopeDenied(session, "Solo puede gestionar usuarios dentro de su institución", targetId);
    return { admin, institutionId: targetInstitution };
  }
  const headRoles: AppRole[] = ["MAGISTRADO_CORTE_SUPREMA","MAGISTRADO_TRIBUNAL","JUEZ_CIRCUITO","JUEZ_MUNICIPAL"];
  const workerRoles: AppRole[] = ["SECRETARIO_DESPACHO","OFICIAL_MAYOR","AUXILIAR","RADICADOR","ARCHIVO","CONSULTA_PUBLICA"];
  if (headRoles.includes(actor.role)) {
    if (!actor.is_dependency_leader) {
      await session.supabase.rpc("log_security_event", { p_action: "USER_CREATION_SCOPE_DENIED", p_table: "profiles", p_record_id: targetId || null, p_description: "El usuario no es juez o magistrado responsable del despacho", p_metadata: { dependency_id: actor.dependency_id } });
      usersRedirect("error", "Solo el juez o magistrado asignado al despacho puede crear personal en esta dependencia");
    }
    if (!targetId) await enforcePermission(session, PERMISSIONS.usersCreateInDependency);
    if (!actor.dependency_id || target.dependency_id !== actor.dependency_id || !workerRoles.includes(target.role)) await scopeDenied(session, "La jefatura solo puede crear personal operativo de su propio despacho", targetId);
    return { admin, institutionId: actorInstitution };
  }
  if (!targetId) await enforcePermission(session, PERMISSIONS.usersCreateInDependency);
  if (!actor.dependency_id || target.dependency_id !== actor.dependency_id || !workerRoles.includes(target.role)) await scopeDenied(session, "El permiso concedido se limita a personal de su propia dependencia", targetId);
  if (targetId === actor.id) usersRedirect("error", "No puede modificar su propio alcance desde esta operación");
  return { admin, institutionId: actorInstitution };
}

async function writeAudit(admin: NonNullable<ReturnType<typeof createAdminClient>>, actorId: string, targetId: string, action: string, description: string, oldValues: Record<string, unknown> | null, newValues: Record<string, unknown> | null) {
  const { error } = await admin.from("audit_logs").insert({ user_id: actorId, target_user_id: targetId, action, table_name: "profiles", record_id: targetId, description, old_values: oldValues, new_values: newValues, metadata: { source: "institutional_user_management" } });
  if (error) throw new Error(`No fue posible registrar la auditoría: ${error.message}`);
}

export async function inviteUser(formData: FormData) {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) usersRedirect("error", parsed.error.issues[0].message, "/admin/usuarios/nuevo");
  const session = await requirePermission(PERMISSIONS.usersCreate);
  const { admin, institutionId } = await assertManagementScope(session, parsed.data);
  const email = parsed.data.email.toLowerCase();
  const { data, error } = await admin.auth.admin.createUser({ email, password: parsed.data.temporary_password, email_confirm: true, user_metadata: { full_name: parsed.data.full_name } });
  if (error || !data.user) usersRedirect("error", error?.message ?? "No fue posible crear el usuario", "/admin/usuarios/nuevo");
  if (parsed.data.is_dependency_leader === "true") await enforcePermission(session, PERMISSIONS.dependenciesAssignLeader);
  const profile = { id: data.user.id, email, full_name: parsed.data.full_name, role: parsed.data.role, institution_id: institutionId, dependency_id: parsed.data.dependency_id || null, supervisor_id: parsed.data.supervisor_id || null, position_title: parsed.data.position_title || null, is_active: parsed.data.is_active === "true", public_profile: parsed.data.public_profile === "true", is_dependency_leader: parsed.data.is_dependency_leader === "true", is_owner: false };
  const { error: profileError } = await admin.from("profiles").upsert(profile, { onConflict: "id" });
  if (profileError) { await admin.auth.admin.deleteUser(data.user.id); usersRedirect("error", profileError.message, "/admin/usuarios/nuevo"); }
  await writeAudit(admin, session.user.id, data.user.id, "USER_CREATED", "Usuario activo creado y asignado institucionalmente", null, { role: profile.role, institution_id: profile.institution_id, dependency_id: profile.dependency_id, supervisor_id: profile.supervisor_id, is_active: profile.is_active });
  revalidatePath("/admin/usuarios"); revalidatePath("/instituciones");
  usersRedirect("success", "Usuario activo creado con contraseña temporal");
}

export async function updateManagedUser(formData: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) usersRedirect("error", parsed.error.issues[0].message);
  const session = await requirePermission(PERMISSIONS.usersEdit);
  const adminClient = createAdminClient(); if (!adminClient) usersRedirect("error", "Falta SUPABASE_SERVICE_ROLE_KEY");
  const { data: current } = await adminClient.from("profiles").select("id,full_name,role,institution_id,dependency_id,supervisor_id,position_title,is_active,is_owner,public_profile,is_dependency_leader").eq("id", parsed.data.target_id).maybeSingle();
  if (!current) usersRedirect("error", "El usuario no existe");
  if (current.is_owner) { await session.supabase.rpc("log_security_event", { p_action: "OWNER_PROTECTION_DENIED", p_table: "profiles", p_record_id: current.id, p_description: "Se impidió modificar la cuenta propietaria protegida", p_metadata: {} }); usersRedirect("error", "La cuenta propietaria está protegida"); }
  const { admin, institutionId } = await assertManagementScope(session, parsed.data, current.id);
  if (current.role !== parsed.data.role) await enforcePermission(session, PERMISSIONS.usersAssignRole, current.id);
  if (current.dependency_id !== (parsed.data.dependency_id || null)) await enforcePermission(session, PERMISSIONS.usersAssignDependency, current.id);
  const nextLeader = parsed.data.is_dependency_leader === "true";
  if (current.is_dependency_leader !== nextLeader) await enforcePermission(session, PERMISSIONS.dependenciesAssignLeader, current.id);
  const nextActive = parsed.data.is_active === "true";
  if (current.is_active && !nextActive) await enforcePermission(session, PERMISSIONS.usersDeactivate, current.id);
  if (!current.is_active && nextActive) await enforcePermission(session, PERMISSIONS.usersReactivate, current.id);
  const next = { full_name: parsed.data.full_name, role: parsed.data.role, institution_id: institutionId, dependency_id: parsed.data.dependency_id || null, supervisor_id: parsed.data.supervisor_id || null, position_title: parsed.data.position_title || null, public_profile: parsed.data.public_profile === "true", is_dependency_leader: nextLeader, is_active: nextActive };
  const { error } = await admin.from("profiles").update(next).eq("id", current.id).eq("is_owner", false);
  if (error) usersRedirect("error", error.message);
  await writeAudit(admin, session.user.id, current.id, "USER_ACCESS_UPDATED", "Usuario, cargo y asignación institucional actualizados", current, next);
  revalidatePath("/admin/usuarios"); revalidatePath("/instituciones");
  usersRedirect("success", "Usuario actualizado y cambio auditado");
}

export async function sendPasswordSetup(formData: FormData) {
  const parsed = targetSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) usersRedirect("error", "Usuario no válido");
  const session = await requirePermission(PERMISSIONS.usersEdit); const admin = createAdminClient(); if (!admin) usersRedirect("error", "Falta SUPABASE_SERVICE_ROLE_KEY");
  const { data: target } = await admin.from("profiles").select("id,email,is_owner,role,institution_id,dependency_id").eq("id", parsed.data.target_id).maybeSingle();
  if (!target) usersRedirect("error", "El usuario no existe");
  if (target.is_owner && target.id !== session.user.id) usersRedirect("error", "Solo el propietario puede gestionar su propia recuperación");
  if (!target.is_owner) await assertManagementScope(session, target, target.id);
  const { error } = await admin.auth.resetPasswordForEmail(target.email, { redirectTo: passwordRedirectUrl() }); if (error) usersRedirect("error", error.message);
  await writeAudit(admin, session.user.id, target.id, "PASSWORD_SETUP_SENT", "Se envió un enlace privado para configurar la contraseña", null, { requested: true });
  usersRedirect("success", "Enlace de contraseña enviado");
}
