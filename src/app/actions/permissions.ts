"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requireOwnerPermission } from "@/lib/auth/permissions";
import {
  MANAGEABLE_PERMISSION_CATALOG,
  type PermissionAction,
  type PermissionResource,
} from "@/lib/permissions/catalog";
import { APP_ROLES } from "@/lib/user-management";
import { dbUuid } from "@/lib/validation";

function userRedirect(userId: string, kind: "error" | "success", message: string): never {
  redirect(`/admin/usuarios/${userId}/permisos?${kind}=${encodeURIComponent(message)}`);
}

function formPermissionValue(formData: FormData, resource: PermissionResource, action: PermissionAction) {
  return String(formData.get(`permission__${resource}__${action}`) ?? "");
}

export type PermissionActionState = { error?: string };

export async function updateRolePermissions(
  _previousState: PermissionActionState,
  formData: FormData,
): Promise<PermissionActionState> {
  const role = z.enum(APP_ROLES).safeParse(formData.get("role"));
  if (!role.success) return { error: "Seleccione un rol válido" };
  if (formData.get("confirmed") !== "true") return { error: "Debe confirmar el cambio de permisos" };
  const { supabase } = await requireOwnerPermission(PERMISSIONS.rolesManage);
  const entries = MANAGEABLE_PERMISSION_CATALOG.flatMap(({ resource, actions }) =>
    actions.map((action) => ({
      resource,
      action,
      allowed: formPermissionValue(formData, resource, action) === "allow",
    })),
  );
  if (
    role.data === "SUPER_ADMIN" &&
    entries.some((entry) => entry.resource === "roles" && entry.action === "manage" && !entry.allowed)
  ) {
    return { error: "El propietario no puede perder la administración de roles" };
  }
  const { error } = await supabase.rpc("replace_role_permission_rules", {
    p_role: role.data,
    p_entries: entries,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/roles");
  redirect(`/admin/roles?success=${encodeURIComponent(`Permisos de ${role.data} actualizados y auditados`)}`);
}

export async function updateUserPermissionOverrides(
  _previousState: PermissionActionState,
  formData: FormData,
): Promise<PermissionActionState> {
  const target = dbUuid.safeParse(formData.get("target_id"));
  if (!target.success) redirect("/admin/usuarios?error=Usuario%20no%20válido");
  if (formData.get("confirmed") !== "true") return { error: "Debe confirmar el cambio de permisos" };
  const reason = z.string().trim().max(500).safeParse(formData.get("reason") ?? "");
  if (!reason.success) return { error: "El motivo no puede superar 500 caracteres" };
  const { supabase } = await requireOwnerPermission(PERMISSIONS.rolesManage);
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,is_owner")
    .eq("id", target.data)
    .maybeSingle();
  if (!profile) return { error: "El usuario no existe" };
  if (profile.is_owner) {
    await supabase.rpc("log_security_event", {
      p_action: "OWNER_PERMISSION_OVERRIDE_DENIED",
      p_table: "user_permission_overrides",
      p_record_id: profile.id,
      p_description: "Se impidió modificar los permisos personalizados de la cuenta propietaria",
      p_metadata: { source: "custom_permissions_page" },
    });
    return { error: "La cuenta propietaria no admite permisos personalizados" };
  }

  const entries = MANAGEABLE_PERMISSION_CATALOG.flatMap(({ resource, actions }) =>
    actions.flatMap((action) => {
      const value = formPermissionValue(formData, resource, action);
      return value === "allow" || value === "deny"
        ? [{ resource, action, effect: value }]
        : [];
    }),
  );
  const { data, error } = await supabase.rpc("replace_user_permission_overrides", {
    p_user_id: target.data,
    p_entries: entries,
    p_reason: reason.data || null,
  });
  if (error) return { error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { error: result?.error ?? "No fue posible actualizar los permisos personalizados" };
  revalidatePath(`/admin/usuarios/${target.data}/permisos`);
  revalidatePath("/admin/usuarios");
  userRedirect(target.data, "success", "Permisos personalizados actualizados y auditados");
}
