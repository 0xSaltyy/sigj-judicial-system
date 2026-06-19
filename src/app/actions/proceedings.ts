"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseAccess, RESOURCE_ROLES } from "@/lib/auth/permissions";

const schema = z.object({ case_id: z.string().uuid(), type: z.string().trim().min(2), title: z.string().trim().min(3), chamber: z.string().trim().min(2), content_markdown: z.string().trim().min(20), status: z.enum(["Borrador", "En revisión", "Firmado", "Publicado"]), visibility: z.enum(["public", "internal", "reserved"]) });

export async function createProceeding(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/providencias/nueva?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase, user } = await requireCaseAccess(parsed.data.case_id, RESOURCE_ROLES.proceedingsWrite);
  const { data: number, error: numberError } = await supabase.rpc("generate_providence_number", { p_prefix: parsed.data.type.slice(0, 3).toUpperCase() });
  if (numberError || !number) redirect(`/admin/providencias/nueva?error=${encodeURIComponent(numberError?.message ?? "No fue posible generar el número")}`);
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("proceedings").insert({ ...parsed.data, providence_number: number, judge_id: user.id, created_by: user.id, signed_at: ["Firmado", "Publicado"].includes(parsed.data.status) ? now : null, published_at: parsed.data.status === "Publicado" ? now : null, signed_by: ["Firmado", "Publicado"].includes(parsed.data.status) ? user.id : null }).select("id").single();
  if (error || !data) redirect(`/admin/providencias/nueva?error=${encodeURIComponent(error?.message ?? "No fue posible guardar")}`);
  revalidatePath("/admin/providencias");
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  redirect(`/admin/providencias/${data.id}?success=${encodeURIComponent("Providencia guardada")}`);
}

export async function publishProceeding(formData: FormData) {
  const parsed = z.object({ id: z.string().uuid(), case_id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/providencias?error=Providencia%20no%20válida");
  const { supabase, user } = await requireCaseAccess(parsed.data.case_id, RESOURCE_ROLES.proceedingsWrite);
  const now = new Date().toISOString();
  const { error } = await supabase.from("proceedings").update({ status: "Publicado", published_at: now, signed_at: now, signed_by: user.id }).eq("id", parsed.data.id);
  if (error) redirect(`/admin/providencias/${parsed.data.id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/providencias");
  redirect(`/admin/providencias/${parsed.data.id}?success=${encodeURIComponent("Providencia publicada")}`);
}
