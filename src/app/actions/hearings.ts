"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseAccess, RESOURCE_ROLES } from "@/lib/auth/permissions";

const schema = z.object({
  hearing_id: z.string().uuid().optional(), case_id: z.string().uuid(), title: z.string().trim().min(3),
  hearing_type: z.string().trim().min(2), scheduled_at: z.string().min(1), end_at: z.string().optional(),
  room: z.string().trim().min(2), virtual_link: z.string().trim().url().optional().or(z.literal("")),
  status: z.string().trim().min(2), participants: z.string().optional(), notes: z.string().trim().max(4000).optional(),
  is_public: z.enum(["true", "false"]),
});

function destination(id: string, kind: "error" | "success", message: string): never {
  redirect(`/admin/audiencias/${id}/editar?${kind}=${encodeURIComponent(message)}`);
}

export async function saveHearing(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/audiencias/nueva?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase, user } = await requireCaseAccess(parsed.data.case_id, RESOURCE_ROLES.hearingsWrite);
  const payload = {
    case_id: parsed.data.case_id, title: parsed.data.title, hearing_type: parsed.data.hearing_type,
    scheduled_at: new Date(parsed.data.scheduled_at).toISOString(), end_at: parsed.data.end_at ? new Date(parsed.data.end_at).toISOString() : null,
    room: parsed.data.room, virtual_link: parsed.data.virtual_link || null, status: parsed.data.status,
    participants: (parsed.data.participants ?? "").split("\n").map((name) => name.trim()).filter(Boolean).map((name) => ({ name })),
    notes: parsed.data.notes || null, is_public: parsed.data.is_public === "true",
  };
  if (parsed.data.hearing_id) {
    const { error } = await supabase.from("hearings").update(payload).eq("id", parsed.data.hearing_id).eq("case_id", parsed.data.case_id);
    if (error) destination(parsed.data.hearing_id, "error", error.message);
    revalidatePath("/admin/audiencias");
    revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
    destination(parsed.data.hearing_id, "success", "Audiencia actualizada");
  }
  const { data, error } = await supabase.from("hearings").insert({ ...payload, created_by: user.id }).select("id").single();
  if (error || !data) redirect(`/admin/audiencias/nueva?error=${encodeURIComponent(error?.message ?? "No fue posible crear la audiencia")}`);
  revalidatePath("/admin/audiencias");
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  destination(data.id, "success", "Audiencia programada");
}

export async function cancelHearing(formData: FormData) {
  const parsed = z.object({ hearing_id: z.string().uuid(), case_id: z.string().uuid(), cancellation_reason: z.string().trim().min(5) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/audiencias?error=Datos%20de%20cancelación%20inválidos");
  const { supabase } = await requireCaseAccess(parsed.data.case_id, RESOURCE_ROLES.hearingsWrite);
  const { error } = await supabase.from("hearings").update({ status: "Cancelada", cancellation_reason: parsed.data.cancellation_reason }).eq("id", parsed.data.hearing_id);
  if (error) destination(parsed.data.hearing_id, "error", error.message);
  revalidatePath("/admin/audiencias");
  destination(parsed.data.hearing_id, "success", "Audiencia cancelada");
}
