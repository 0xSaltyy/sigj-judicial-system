"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_ROLES } from "@/lib/user-management";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));
const inviteSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(3).max(140),
  role: z.enum(APP_ROLES),
  dependency_id: optionalUuid,
  position_title: z.string().trim().max(120).optional(),
  creation_method: z.enum(["invite", "temporary_password"]),
  temporary_password: z.string().optional(),
  is_active: z.enum(["true", "false"]),
});
const updateSchema = z.object({
  target_id: z.string().uuid(),
  full_name: z.string().trim().min(3).max(140),
  role: z.enum(APP_ROLES),
  dependency_id: optionalUuid,
  position_title: z.string().trim().max(120).optional(),
  is_active: z.enum(["true", "false"]),
});
const targetSchema = z.object({ target_id: z.string().uuid() });

function usersRedirect(kind: "error" | "success", message: string, path = "/admin/usuarios"): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

function passwordRedirectUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!appUrl) throw new Error("Falta NEXT_PUBLIC_APP_URL");
  return `${appUrl}/actualizar-password`;
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof requireOwner>>["supabase"],
  actorId: string,
  targetId: string,
  action: string,
  description: string,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
) {
  const { error } = await supabase.from("audit_logs").insert({
    user_id: actorId,
    target_user_id: targetId,
    action,
    table_name: "profiles",
    record_id: targetId,
    description,
    old_values: oldValues,
    new_values: newValues,
    metadata: { source: "owner_user_management" },
  });
  if (error) throw new Error(`No fue posible registrar la auditoría: ${error.message}`);
}

export async function inviteUser(formData: FormData) {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) usersRedirect("error", parsed.error.issues[0].message, "/admin/usuarios/nuevo");
  const { supabase, user } = await requireOwner();
  const admin = createAdminClient();
  if (!admin) usersRedirect("error", "Falta SUPABASE_SERVICE_ROLE_KEY", "/admin/usuarios/nuevo");
  if (parsed.data.creation_method === "invite" && !process.env.NEXT_PUBLIC_APP_URL) usersRedirect("error", "Falta NEXT_PUBLIC_APP_URL", "/admin/usuarios/nuevo");

  if (parsed.data.dependency_id) {
    const { data: institution } = await supabase.from("dependencies").select("id").eq("id", parsed.data.dependency_id).eq("is_active", true).maybeSingle();
    if (!institution) usersRedirect("error", "La institución seleccionada no está disponible", "/admin/usuarios/nuevo");
  }

  const email = parsed.data.email.toLowerCase();
  if (parsed.data.creation_method === "temporary_password" && (!parsed.data.temporary_password || parsed.data.temporary_password.length < 8)) usersRedirect("error", "La contraseña temporal debe tener al menos 8 caracteres", "/admin/usuarios/nuevo");
  const { data, error } = parsed.data.creation_method === "temporary_password"
    ? await admin.auth.admin.createUser({ email, password: parsed.data.temporary_password!, email_confirm: true, user_metadata: { full_name: parsed.data.full_name } })
    : await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: parsed.data.full_name }, redirectTo: passwordRedirectUrl() });
  if (error || !data.user) usersRedirect("error", error?.message ?? "No fue posible enviar la invitación", "/admin/usuarios/nuevo");

  const profile = {
    id: data.user.id,
    email,
    full_name: parsed.data.full_name,
    role: parsed.data.role,
    dependency_id: parsed.data.dependency_id || null,
    position_title: parsed.data.position_title || null,
    is_active: parsed.data.is_active === "true",
    is_owner: false,
  };
  const { error: profileError } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    usersRedirect("error", profileError.message, "/admin/usuarios/nuevo");
  }
  try {
    await writeAudit(supabase, user.id, data.user.id, parsed.data.creation_method === "invite" ? "USER_INVITED" : "USER_CREATED", parsed.data.creation_method === "invite" ? "Usuario creado mediante invitación del propietario" : "Usuario creado con contraseña temporal", null, { role: profile.role, dependency_id: profile.dependency_id, is_active: profile.is_active });
  } catch (error) {
    usersRedirect("error", error instanceof Error ? error.message : "No fue posible registrar la auditoría", "/admin/usuarios/nuevo");
  }
  revalidatePath("/admin/usuarios");
  usersRedirect("success", parsed.data.creation_method === "invite" ? "Invitación enviada correctamente" : "Usuario creado con contraseña temporal");
}

export async function updateManagedUser(formData: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) usersRedirect("error", parsed.error.issues[0].message);
  const { supabase, user } = await requireOwner();
  const { data: current, error: currentError } = await supabase
    .from("profiles")
    .select("id,full_name,role,dependency_id,position_title,is_active,is_owner")
    .eq("id", parsed.data.target_id)
    .maybeSingle();
  if (currentError || !current) usersRedirect("error", "El usuario no existe");
  if (current.is_owner) usersRedirect("error", "La cuenta propietaria está protegida y no puede modificarse desde esta operación");

  if (parsed.data.dependency_id) {
    const { data: institution } = await supabase.from("dependencies").select("id").eq("id", parsed.data.dependency_id).eq("is_active", true).maybeSingle();
    if (!institution) usersRedirect("error", "La institución seleccionada no está disponible");
  }

  const next = {
    full_name: parsed.data.full_name,
    role: parsed.data.role,
    dependency_id: parsed.data.dependency_id || null,
    position_title: parsed.data.position_title || null,
    is_active: parsed.data.is_active === "true",
  };
  const { error } = await supabase.from("profiles").update(next).eq("id", parsed.data.target_id);
  if (error) usersRedirect("error", error.message);
  await writeAudit(supabase, user.id, parsed.data.target_id, "USER_ACCESS_UPDATED", "El propietario actualizó rol, institución o estado de acceso", current, next);
  revalidatePath("/admin/usuarios");
  usersRedirect("success", "Usuario actualizado y cambio auditado");
}

export async function sendPasswordSetup(formData: FormData) {
  const parsed = targetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) usersRedirect("error", "Usuario no válido");
  const { supabase, user } = await requireOwner();
  const admin = createAdminClient();
  if (!admin) usersRedirect("error", "Falta SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.NEXT_PUBLIC_APP_URL) usersRedirect("error", "Falta NEXT_PUBLIC_APP_URL");
  const { data: target } = await supabase.from("profiles").select("id,email,is_owner").eq("id", parsed.data.target_id).maybeSingle();
  if (!target) usersRedirect("error", "El usuario no existe");
  if (target.is_owner && target.id !== user.id) usersRedirect("error", "Solo el propietario puede gestionar su propia recuperación");
  const { error } = await admin.auth.resetPasswordForEmail(target.email, { redirectTo: passwordRedirectUrl() });
  if (error) usersRedirect("error", error.message);
  await writeAudit(supabase, user.id, target.id, "PASSWORD_SETUP_SENT", "Se envió un enlace privado para configurar o restablecer la contraseña", null, { requested: true });
  usersRedirect("success", "Enlace de contraseña enviado");
}
