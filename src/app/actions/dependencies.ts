"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canManageDependency } from "@/lib/auth/permissions";
import { requireInternalUser } from "@/lib/auth/authorization";
import { dbUuid } from "@/lib/validation";
import { defaultJurisdiction } from "@/lib/institutional-language";
import { safeActionError } from "@/lib/action-errors";

export async function saveDependency(formData: FormData) {
  const parsed = z
    .object({
      id: dbUuid.optional().or(z.literal("")),
      parent_id: dbUuid.optional().or(z.literal("")),
      name: z.string().trim().min(3),
      code: z.string().trim().min(2).max(12),
      type: z.string().trim().min(2),
      level: z.coerce.number().int("El nivel jerárquico debe ser un número entero").min(1,"El nivel jerárquico mínimo es 1").max(10,"El nivel jerárquico máximo es 10"),
      description: z.string().trim().max(1000).optional(),
      competence: z.string().trim().min(5),
      jurisdiction: z.string().trim().max(240).optional(),
      route_slug: z.string().trim().min(2),
      department: z.string().trim().min(2),
      municipality: z.string().trim().min(2),
      is_active: z.enum(["true", "false"]),
      public_visible: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(
      `/admin/dependencias?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  const session = await requireInternalUser();
  const { supabase } = session;
  const action = parsed.data.id ? "edit" : "create";
  const allowed = await canManageDependency(session.profile, action, { supabase });
  if (!allowed) {
    if (process.env.NODE_ENV === "development") {
      console.info("Dependency permission denied", {
        userId: session.user.id,
        role: session.profile.role,
        institutionId: session.profile.institution_id,
        dependencyId: session.profile.dependency_id,
        action,
      });
    }
    await supabase.rpc("log_security_event", {
      p_action: "DEPENDENCY_MANAGEMENT_DENIED",
      p_table: "dependencies",
      p_record_id: parsed.data.id || null,
      p_description: `Intento de ${action === "create" ? "crear" : "editar"} una dependencia sin permiso efectivo`,
      p_metadata: { action },
    });
    redirect(`/admin/dependencias?error=${encodeURIComponent(action === "create" ? "No tiene permiso para crear dependencias." : "No tiene permiso para editar dependencias.")}`);
  }
  const globalScope = session.profile.is_owner || session.profile.role === "SUPER_ADMIN";
  if (!parsed.data.parent_id && !globalScope)
    redirect("/admin/dependencias?error=Solo%20la%20superadministración%20puede%20crear%20o%20editar%20instituciones%20raíz");
  const payload = {
    ...parsed.data,
    id: undefined,
    code: parsed.data.code.toUpperCase(),
    parent_id: parsed.data.parent_id || null,
    description: parsed.data.description || null,
    jurisdiction: parsed.data.jurisdiction || defaultJurisdiction(parsed.data.type, parsed.data.name),
    is_active: parsed.data.is_active === "true",
    public_visible: parsed.data.public_visible === "true",
  };
  const result = await supabase.rpc("save_dependency_scoped", { p_id: parsed.data.id || null, p_payload: payload });
  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.info("Dependency scope rejected", {
        userId: session.user.id,
        role: session.profile.role,
        institutionId: session.profile.institution_id,
        dependencyId: session.profile.dependency_id,
        action,
        reason: result.error.message,
      });
    }
    redirect(
      `/admin/dependencias?error=${encodeURIComponent(safeActionError(result.error,"No fue posible guardar la dependencia"))}`,
    );
  }
  revalidatePath("/admin/dependencias");
  redirect(
    `/admin/dependencias?success=${encodeURIComponent("Dependencia guardada")}`,
  );
}
