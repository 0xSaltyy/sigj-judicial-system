"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseAccess, RESOURCE_ROLES } from "@/lib/auth/permissions";

const schema = z.object({
  case_id: z.string().uuid(),
  action_type: z.string().trim().min(2).max(100),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(5).max(5000),
  visibility: z.enum(["public", "internal", "reserved"]),
});

export async function createCaseAction(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/actuaciones/nueva?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase, user } = await requireCaseAccess(parsed.data.case_id, RESOURCE_ROLES.actionsWrite);
  const { error } = await supabase.from("case_actions").insert({ ...parsed.data, created_by: user.id });
  if (error) redirect(`/admin/actuaciones/nueva?caseId=${parsed.data.case_id}&error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/actuaciones");
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  redirect(`/admin/expedientes/${parsed.data.case_id}?success=${encodeURIComponent("Actuación registrada")}`);
}
