"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requireCaseAccess } from "@/lib/auth/permissions";
import { dbUuid } from "@/lib/validation";

const schema = z.object({
  case_id: dbUuid,
  action_type: z.string().trim().min(2).max(100),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(5).max(5000),
  visibility: z.enum(["public", "internal", "reserved"]),
});

export async function createCaseAction(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const caseId = String(formData.get("case_id") ?? "");
    redirect(
      `/admin/actuaciones/nueva?caseId=${encodeURIComponent(caseId)}&error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  }
  const { supabase, user } = await requireCaseAccess(
    parsed.data.case_id,
    PERMISSIONS.actionsCreate,
  );
  const { error } = await supabase
    .from("case_actions")
    .insert({ ...parsed.data, created_by: user.id });
  if (error)
    redirect(
      `/admin/actuaciones/nueva?caseId=${parsed.data.case_id}&error=${encodeURIComponent(error.message)}`,
    );
  revalidatePath("/admin/actuaciones");
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  redirect(
    `/admin/expedientes/${parsed.data.case_id}?success=${encodeURIComponent("Actuación registrada")}`,
  );
}
