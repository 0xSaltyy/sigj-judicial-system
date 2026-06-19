"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/authorization";

export async function saveDependency(formData: FormData) {
  const parsed = z.object({ id: z.string().uuid().optional().or(z.literal("")), name: z.string().trim().min(3), code: z.string().trim().min(2).max(12), type: z.string().trim().min(2), competence: z.string().trim().min(5), jurisdiction: z.string().trim().min(2), route_slug: z.string().trim().min(2), department: z.string().trim().min(2), municipality: z.string().trim().min(2), is_active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/dependencias?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase } = await requireOwner();
  const payload = { ...parsed.data, id: undefined, code: parsed.data.code.toUpperCase(), is_active: parsed.data.is_active === "true" };
  const result = parsed.data.id ? await supabase.from("dependencies").update(payload).eq("id", parsed.data.id) : await supabase.from("dependencies").insert(payload);
  if (result.error) redirect(`/admin/dependencias?error=${encodeURIComponent(result.error.message)}`);
  revalidatePath("/admin/dependencias");
  redirect(`/admin/dependencias?success=${encodeURIComponent("Dependencia guardada")}`);
}
