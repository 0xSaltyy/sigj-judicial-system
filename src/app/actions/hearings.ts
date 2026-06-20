"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requireCaseAccess } from "@/lib/auth/permissions";
import { dbUuid } from "@/lib/validation";

const schema = z.object({
  hearing_id: dbUuid.optional(),
  case_id: dbUuid,
  title: z.string().trim().min(3),
  hearing_type: z.string().trim().min(2),
  scheduled_at: z.string().min(1),
  end_at: z.string().optional(),
  room: z.string().trim().max(200).optional(),
  virtual_link: z.string().trim().url().optional().or(z.literal("")),
  status: z.string().trim().min(2),
  participants: z.string().optional(),
  notes: z.string().trim().max(4000).optional(),
  is_public: z.enum(["true", "false"]),
});

function destination(
  id: string,
  kind: "error" | "success",
  message: string,
): never {
  redirect(
    `/admin/audiencias/${id}/editar?${kind}=${encodeURIComponent(message)}`,
  );
}

export async function saveHearing(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const caseId = String(formData.get("case_id") ?? "");
    redirect(
      `/admin/audiencias/nueva?caseId=${encodeURIComponent(caseId)}&error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  }
  const { supabase, user } = await requireCaseAccess(
    parsed.data.case_id,
    parsed.data.hearing_id ? PERMISSIONS.hearingsEdit : PERMISSIONS.hearingsCreate,
  );
  const payload = {
    case_id: parsed.data.case_id,
    title: parsed.data.title,
    hearing_type: parsed.data.hearing_type,
    scheduled_at: new Date(parsed.data.scheduled_at).toISOString(),
    end_at: parsed.data.end_at
      ? new Date(parsed.data.end_at).toISOString()
      : null,
    room: parsed.data.room || null,
    virtual_link: parsed.data.virtual_link || null,
    status: parsed.data.status,
    participants: (parsed.data.participants ?? "")
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name })),
    notes: parsed.data.notes || null,
    is_public: parsed.data.is_public === "true",
  };
  if (parsed.data.hearing_id) {
    const { error } = await supabase
      .from("hearings")
      .update(payload)
      .eq("id", parsed.data.hearing_id)
      .eq("case_id", parsed.data.case_id);
    if (error) destination(parsed.data.hearing_id, "error", error.message);
    revalidatePath("/admin/audiencias");
    revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
    destination(parsed.data.hearing_id, "success", "Audiencia actualizada");
  }
  const { data, error } = await supabase
    .from("hearings")
    .insert({ ...payload, created_by: user.id })
    .select("id")
    .single();
  if (error || !data)
    redirect(
      `/admin/audiencias/nueva?error=${encodeURIComponent(error?.message ?? "No fue posible crear la audiencia")}`,
    );
  revalidatePath("/admin/audiencias");
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  destination(data.id, "success", "Audiencia programada");
}

export async function cancelHearing(formData: FormData) {
  const parsed = z
    .object({
      hearing_id: dbUuid,
      case_id: dbUuid,
      cancellation_reason: z.string().trim().min(5),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect("/admin/audiencias?error=Datos%20de%20cancelación%20inválidos");
  const { supabase } = await requireCaseAccess(
    parsed.data.case_id,
    PERMISSIONS.hearingsEdit,
  );
  const { error } = await supabase
    .from("hearings")
    .update({
      status: "Cancelada",
      cancellation_reason: parsed.data.cancellation_reason,
    })
    .eq("id", parsed.data.hearing_id);
  if (error) destination(parsed.data.hearing_id, "error", error.message);
  revalidatePath("/admin/audiencias");
  destination(parsed.data.hearing_id, "success", "Audiencia cancelada");
}

const minutesSchema = z.object({
  minute_id: dbUuid.optional().or(z.literal("")), hearing_id: dbUuid, case_id: dbUuid,
  started_at: z.string().optional(), ended_at: z.string().optional(), chamber: z.string().trim().max(180).optional(),
  interveners: z.string().trim().max(12000).optional(), attendees: z.string().trim().max(12000).optional(), absences: z.string().trim().max(12000).optional(),
  development_markdown: z.string().trim().max(100000).optional(), decisions_markdown: z.string().trim().max(100000).optional(), evidence_markdown: z.string().trim().max(100000).optional(), records_markdown: z.string().trim().max(100000).optional(), observations_markdown: z.string().trim().max(100000).optional(), closing_markdown: z.string().trim().max(100000).optional(),
  secretary_signature_required: z.string().optional(), judge_signature_required: z.string().optional(),
});

export async function saveHearingMinutes(formData: FormData) {
  const parsed = minutesSchema.safeParse(Object.fromEntries(formData));
  const hearingId = String(formData.get("hearing_id") || "");
  if (!parsed.success) redirect(`/admin/audiencias/${hearingId}/acta?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase, user } = await requireCaseAccess(
    parsed.data.case_id,
    parsed.data.minute_id ? PERMISSIONS.minutesEdit : PERMISSIONS.minutesCreate,
  );
  const { data: hearing } = await supabase.from("hearings").select("id").eq("id", parsed.data.hearing_id).eq("case_id", parsed.data.case_id).is("archived_at", null).maybeSingle();
  if (!hearing) redirect(`/admin/audiencias/${parsed.data.hearing_id}/acta?error=Audiencia%20no%20disponible`);
  const payload = { hearing_id: parsed.data.hearing_id, case_id: parsed.data.case_id, started_at: parsed.data.started_at ? new Date(parsed.data.started_at).toISOString() : null, ended_at: parsed.data.ended_at ? new Date(parsed.data.ended_at).toISOString() : null, chamber: parsed.data.chamber || null, interveners: parsed.data.interveners || null, attendees: parsed.data.attendees || null, absences: parsed.data.absences || null, development_markdown: parsed.data.development_markdown || "", decisions_markdown: parsed.data.decisions_markdown || "", evidence_markdown: parsed.data.evidence_markdown || "", records_markdown: parsed.data.records_markdown || "", observations_markdown: parsed.data.observations_markdown || "", closing_markdown: parsed.data.closing_markdown || "", secretary_signature_required: parsed.data.secretary_signature_required === "true", judge_signature_required: parsed.data.judge_signature_required === "true" };
  const result = parsed.data.minute_id ? await supabase.from("hearing_minutes").update(payload).eq("id", parsed.data.minute_id).eq("status", "Borrador") : await supabase.from("hearing_minutes").insert({ ...payload, created_by: user.id });
  if (result.error) redirect(`/admin/audiencias/${parsed.data.hearing_id}/acta?error=${encodeURIComponent(result.error.message)}`);
  revalidatePath(`/admin/audiencias/${parsed.data.hearing_id}/acta`);
  redirect(`/admin/audiencias/${parsed.data.hearing_id}/acta?success=Acta%20guardada%20como%20borrador`);
}

export async function finalizeHearingMinutes(formData: FormData) {
  const parsed = z.object({ minute_id: dbUuid, hearing_id: dbUuid, case_id: dbUuid, owner_override: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/audiencias?error=Acta%20no%20válida");
  const { supabase, user, profile } = await requireCaseAccess(
    parsed.data.case_id,
    PERMISSIONS.minutesPublish,
  );
  const { data: minute } = await supabase.from("hearing_minutes").select("id,status,secretary_signature_required,judge_signature_required,development_markdown").eq("id", parsed.data.minute_id).eq("hearing_id", parsed.data.hearing_id).maybeSingle();
  if (!minute || minute.status !== "Borrador") redirect(`/admin/audiencias/${parsed.data.hearing_id}/acta?error=El%20acta%20no%20está%20en%20borrador`);
  if ((minute.development_markdown || "").trim().length < 20) redirect(`/admin/audiencias/${parsed.data.hearing_id}/acta?error=Complete%20el%20desarrollo%20antes%20de%20finalizar`);
  const { data: signatures } = await supabase.from("signatures").select("signer_title").eq("target_type", "hearing_minute").eq("target_id", minute.id).eq("status", "signed");
  const hasSecretary = (signatures ?? []).some(s => s.signer_title.toLowerCase().includes("secretar"));
  const hasJudge = (signatures ?? []).some(s => /juez|jueza|magistrad/i.test(s.signer_title));
  const override = profile.is_owner && parsed.data.owner_override === "true";
  if (minute.secretary_signature_required && !hasSecretary && !override) redirect(`/admin/audiencias/${parsed.data.hearing_id}/acta?error=Se%20requiere%20la%20firma%20de%20Secretaría`);
  if (minute.judge_signature_required && !hasJudge && !override) redirect(`/admin/audiencias/${parsed.data.hearing_id}/acta?error=Se%20requiere%20la%20firma%20del%20juez%20o%20magistrado`);
  const now = new Date().toISOString();
  const [minuteResult, hearingResult] = await Promise.all([supabase.from("hearing_minutes").update({ status: "Finalizada", finalized_at: now, finalized_by: user.id }).eq("id", minute.id).eq("status", "Borrador"), supabase.from("hearings").update({ status: "Realizada" }).eq("id", parsed.data.hearing_id)]);
  if (minuteResult.error || hearingResult.error) redirect(`/admin/audiencias/${parsed.data.hearing_id}/acta?error=${encodeURIComponent(minuteResult.error?.message || hearingResult.error?.message || "No fue posible finalizar")}`);
  await supabase.rpc("log_security_event", { p_action: override ? "HEARING_MINUTE_FINALIZED_OVERRIDE" : "HEARING_MINUTE_FINALIZED", p_table: "hearing_minutes", p_record_id: minute.id, p_description: "Acta de audiencia finalizada", p_metadata: { secretary_signature_required: minute.secretary_signature_required, judge_signature_required: minute.judge_signature_required, owner_override: override } });
  revalidatePath(`/admin/audiencias/${parsed.data.hearing_id}/acta`);
  redirect(`/admin/audiencias/${parsed.data.hearing_id}/acta?success=Acta%20finalizada`);
}
