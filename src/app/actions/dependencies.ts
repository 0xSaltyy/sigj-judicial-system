"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
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
      level: z.coerce.number().int().min(1).max(10),
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
  const session = await requirePermission(PERMISSIONS.dependenciesManage);
  const { supabase } = session;
  if (!parsed.data.parent_id && !session.profile.is_owner)
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
  if (result.error)
    redirect(
      `/admin/dependencias?error=${encodeURIComponent(safeActionError(result.error,"No fue posible guardar la dependencia"))}`,
    );
  revalidatePath("/admin/dependencias");
  redirect(
    `/admin/dependencias?success=${encodeURIComponent("Dependencia guardada")}`,
  );
}
