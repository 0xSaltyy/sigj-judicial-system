"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enforcePermission, PERMISSIONS, requireOwnerPermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_ROLES } from "@/lib/user-management";
import { dbUuid } from "@/lib/validation";
import { appUrl } from "@/lib/secure-tokens";

const optionalUuid = dbUuid.optional().or(z.literal(""));
const inviteSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(3).max(140),
  role: z.enum(APP_ROLES),
  dependency_id: optionalUuid,
  position_title: z.string().trim().max(120).optional(),
  creation_method: z.literal("temporary_password"),
  temporary_password: z.string().optional(),
  is_active: z.enum(["true", "false"]),
});
const updateSchema = z.object({
  target_id: dbUuid,
  full_name: z.string().trim().min(3).max(140),
  role: z.enum(APP_ROLES),
  dependency_id: optionalUuid,
  position_title: z.string().trim().max(120).optional(),
  is_active: z.enum(["true", "false"]),
});
const targetSchema = z.object({ target_id: dbUuid });

function usersRedirect(
  kind: "error" | "success",
  message: string,
  path = "/admin/usuarios",
): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

function passwordRedirectUrl() {
  return appUrl("/auth/callback?next=/actualizar-password");
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof requireOwnerPermission>>["supabase"],
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
  if (error)
    throw new Error(`No fue posible registrar la auditoría: ${error.message}`);
}

export async function inviteUser(formData: FormData) {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    usersRedirect(
      "error",
      parsed.error.issues[0].message,
      "/admin/usuarios/nuevo",
    );
  const { supabase, user } = await requireOwnerPermission(PERMISSIONS.usersCreate);
  const admin = createAdminClient();
  if (!admin)
    usersRedirect(
      "error",
      "Falta SUPABASE_SERVICE_ROLE_KEY",
      "/admin/usuarios/nuevo",
    );
  if (parsed.data.dependency_id) {
    const { data: institution } = await supabase
      .from("dependencies")
      .select("id")
      .eq("id", parsed.data.dependency_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!institution)
      usersRedirect(
        "error",
        "La institución seleccionada no está disponible",
        "/admin/usuarios/nuevo",
      );
  }

  const email = parsed.data.email.toLowerCase();
  if (
    !parsed.data.temporary_password ||
    parsed.data.temporary_password.length < 8
  )
    usersRedirect(
      "error",
      "La contraseña temporal debe tener al menos 8 caracteres",
      "/admin/usuarios/nuevo",
    );
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.temporary_password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });
  if (error || !data.user)
    usersRedirect(
      "error",
      error?.message ?? "No fue posible crear el usuario",
      "/admin/usuarios/nuevo",
    );

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
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    usersRedirect("error", profileError.message, "/admin/usuarios/nuevo");
  }
  try {
    await writeAudit(
      supabase,
      user.id,
      data.user.id,
      "USER_CREATED",
      "Usuario activo creado con contraseña temporal",
      null,
      {
        role: profile.role,
        dependency_id: profile.dependency_id,
        is_active: profile.is_active,
      },
    );
  } catch (error) {
    usersRedirect(
      "error",
      error instanceof Error
        ? error.message
        : "No fue posible registrar la auditoría",
      "/admin/usuarios/nuevo",
    );
  }
  revalidatePath("/admin/usuarios");
  usersRedirect("success", "Usuario activo creado con contraseña temporal");
}

export async function updateManagedUser(formData: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) usersRedirect("error", parsed.error.issues[0].message);
  const session = await requireOwnerPermission(PERMISSIONS.usersEdit);
  const { supabase, user } = session;
  const { data: current, error: currentError } = await supabase
    .from("profiles")
    .select("id,full_name,role,dependency_id,position_title,is_active,is_owner")
    .eq("id", parsed.data.target_id)
    .maybeSingle();
  if (currentError || !current) usersRedirect("error", "El usuario no existe");
  if (current.is_owner) {
    await supabase.rpc("log_security_event", {
      p_action: "OWNER_PROTECTION_DENIED",
      p_table: "profiles",
      p_record_id: current.id,
      p_description: "Se impidió modificar la cuenta propietaria protegida",
      p_metadata: { requested_role: parsed.data.role, requested_active: parsed.data.is_active },
    });
    usersRedirect(
      "error",
      "La cuenta propietaria está protegida y no puede modificarse desde esta operación",
    );
  }
  if (current.role !== parsed.data.role)
    await enforcePermission(session, PERMISSIONS.usersAssignRole, current.id);
  const nextActive = parsed.data.is_active === "true";
  if (current.is_active && !nextActive)
    await enforcePermission(session, PERMISSIONS.usersDeactivate, current.id);
  if (!current.is_active && nextActive)
    await enforcePermission(session, PERMISSIONS.usersReactivate, current.id);

  if (parsed.data.dependency_id) {
    const { data: institution } = await supabase
      .from("dependencies")
      .select("id")
      .eq("id", parsed.data.dependency_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!institution)
      usersRedirect("error", "La institución seleccionada no está disponible");
  }

  const next = {
    full_name: parsed.data.full_name,
    role: parsed.data.role,
    dependency_id: parsed.data.dependency_id || null,
    position_title: parsed.data.position_title || null,
    is_active: parsed.data.is_active === "true",
  };
  const { error } = await supabase
    .from("profiles")
    .update(next)
    .eq("id", parsed.data.target_id);
  if (error) usersRedirect("error", error.message);
  await writeAudit(
    supabase,
    user.id,
    parsed.data.target_id,
    "USER_ACCESS_UPDATED",
    "El propietario actualizó rol, institución o estado de acceso",
    current,
    next,
  );
  revalidatePath("/admin/usuarios");
  usersRedirect("success", "Usuario actualizado y cambio auditado");
}

export async function sendPasswordSetup(formData: FormData) {
  const parsed = targetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) usersRedirect("error", "Usuario no válido");
  const { supabase, user } = await requireOwnerPermission(PERMISSIONS.usersEdit);
  const admin = createAdminClient();
  if (!admin) usersRedirect("error", "Falta SUPABASE_SERVICE_ROLE_KEY");
  const { data: target } = await supabase
    .from("profiles")
    .select("id,email,is_owner")
    .eq("id", parsed.data.target_id)
    .maybeSingle();
  if (!target) usersRedirect("error", "El usuario no existe");
  if (target.is_owner && target.id !== user.id)
    usersRedirect(
      "error",
      "Solo el propietario puede gestionar su propia recuperación",
    );
  const { error } = await admin.auth.resetPasswordForEmail(target.email, {
    redirectTo: passwordRedirectUrl(),
  });
  if (error) usersRedirect("error", error.message);
  await writeAudit(
    supabase,
    user.id,
    target.id,
    "PASSWORD_SETUP_SENT",
    "Se envió un enlace privado para configurar o restablecer la contraseña",
    null,
    { requested: true },
  );
  usersRedirect("success", "Enlace de contraseña enviado");
}
