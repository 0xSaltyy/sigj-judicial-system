"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const selfSummarySchema = z.object({
  legal_name: z.string().min(3, "Ingrese el nombre legal"),
  date_of_birth: z.string().optional(),
  person_record_number: z.string().optional(),
  private_access_code: z.string().optional(),
  request_purpose: z.string().min(8, "Indique el propósito de la solicitud"),
  requester_contact: z.string().max(240).optional(),
  subject_declaration: z.literal("on", { message: "Debe declarar que solicita su propio resumen" }),
  consent_acknowledged: z.literal("on", { message: "Debe aceptar las limitaciones del portal" }),
});

const backgroundRequestSchema = z.object({
  subject_legal_name: z.string().min(3, "Ingrese el nombre de la persona consultada"),
  subject_date_of_birth: z.string().optional(),
  requesting_organization: z.string().min(3, "Ingrese la organización solicitante"),
  authorized_purpose: z.string().min(8, "Describa el propósito autorizado"),
  legal_authority_or_consent: z.string().min(12, "Registre consentimiento o fundamento autorizado"),
  scope: z.string().min(8, "Defina el alcance de la revisión"),
});

const correctionSchema = z.object({
  person_record_number: z.string().optional(),
  challenged_event: z.string().min(3, "Indique el evento o registro cuestionado"),
  explanation: z.string().min(20, "Explique la corrección solicitada con más detalle"),
  contact_method: z.string().max(240).optional(),
});

const finalDispositionSchema = z.object({
  case_id: z.string().uuid(),
  person_id: z.string().uuid().optional().or(z.literal("")).or(z.literal("new")),
  legal_first_name: z.string().optional(),
  legal_middle_name: z.string().optional(),
  legal_last_name: z.string().optional(),
  date_of_birth: z.string().optional(),
  count_number: z.coerce.number().int().positive().optional(),
  statute_citation: z.string().min(2, "Ingrese el statute"),
  offense_title: z.string().min(2, "Ingrese el offense"),
  offense_level: z.string().optional(),
  charging_instrument: z.string().optional(),
  disposition_type: z.string().min(3),
  disposition_date: z.string().min(1, "Ingrese la fecha de disposición"),
  judgment_date: z.string().optional(),
  access_classification: z.string().min(3),
  imprisonment: z.string().optional(),
  probation: z.string().optional(),
  supervised_release: z.string().optional(),
  fine_amount: z.string().optional(),
  restitution_amount: z.string().optional(),
  forfeiture: z.string().optional(),
  community_service: z.string().optional(),
  special_assessment: z.string().optional(),
  concurrent_or_consecutive: z.string().optional(),
  other_conditions: z.string().optional(),
  active_supervision: z.string().optional(),
  certification: z.string().min(12, "Certifique la revisión de la fuente"),
});

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeDate(value?: string) {
  return value && value.trim() ? value : null;
}

function neutralDelay() {
  return new Promise((resolve) => setTimeout(resolve, 450 + Math.floor(Math.random() * 250)));
}

export async function submitSelfCriminalHistoryRequest(formData: FormData) {
  await neutralDelay();
  const parsed = selfSummarySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/antecedentes/solicitar?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const admin = createAdminClient();
  if (!admin) redirect("/antecedentes/solicitar?error=Supabase%20no%20est%C3%A1%20configurado");

  const accessCode = parsed.data.private_access_code?.trim();
  const { data, error } = await admin
    .from("criminal_history_summary_requests")
    .insert({
      legal_name: parsed.data.legal_name.trim(),
      date_of_birth: normalizeDate(parsed.data.date_of_birth),
      person_record_number: parsed.data.person_record_number?.trim() || null,
      private_access_code_hash: accessCode ? hashSecret(accessCode) : null,
      request_purpose: parsed.data.request_purpose.trim(),
      requester_contact: parsed.data.requester_contact?.trim() || null,
      subject_declaration: true,
      consent_acknowledged: true,
      verification_token_hash: hashSecret(randomBytes(24).toString("base64url")),
    })
    .select("request_number")
    .single();

  if (error || !data) redirect(`/antecedentes/solicitar?error=${encodeURIComponent("No fue posible registrar la solicitud")}`);
  redirect(`/antecedentes/solicitar?submitted=1&request=${encodeURIComponent(data.request_number)}`);
}

export async function submitBackgroundCheckRequest(formData: FormData) {
  await neutralDelay();
  const parsed = backgroundRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/antecedentes/solicitudes?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const admin = createAdminClient();
  if (!admin) redirect("/antecedentes/solicitudes?error=Supabase%20no%20est%C3%A1%20configurado");
  const { data, error } = await admin
    .from("background_check_requests")
    .insert({
      subject_legal_name: parsed.data.subject_legal_name.trim(),
      subject_date_of_birth: normalizeDate(parsed.data.subject_date_of_birth),
      requesting_organization: parsed.data.requesting_organization.trim(),
      authorized_purpose: parsed.data.authorized_purpose.trim(),
      legal_authority_or_consent: parsed.data.legal_authority_or_consent.trim(),
      scope: parsed.data.scope.trim(),
      audit_history: [{ at: new Date().toISOString(), action: "Submitted", source: "public-background-request" }],
    })
    .select("request_number")
    .single();
  if (error || !data) redirect(`/antecedentes/solicitudes?error=${encodeURIComponent("No fue posible registrar la solicitud")}`);
  redirect(`/antecedentes/solicitudes?submitted=1&request=${encodeURIComponent(data.request_number)}`);
}

export async function submitCriminalHistoryCorrectionRequest(formData: FormData) {
  await neutralDelay();
  const parsed = correctionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/antecedentes/correccion?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const admin = createAdminClient();
  if (!admin) redirect("/antecedentes/correccion?error=Supabase%20no%20est%C3%A1%20configurado");

  const support = formData.get("supporting_document");
  let supportingDocumentPath: string | null = null;
  const { data, error } = await admin
    .from("criminal_history_correction_requests")
    .insert({
      person_record_number: parsed.data.person_record_number?.trim() || null,
      challenged_event: parsed.data.challenged_event.trim(),
      explanation: parsed.data.explanation.trim(),
      contact_method: parsed.data.contact_method?.trim() || null,
    })
    .select("id,request_number")
    .single();
  if (error || !data) redirect(`/antecedentes/correccion?error=${encodeURIComponent("No fue posible registrar la solicitud")}`);

  if (support instanceof File && support.size > 0) {
    const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);
    if (support.size <= 10 * 1024 * 1024 && allowed.has(support.type)) {
      const safeName = support.name.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-120);
      supportingDocumentPath = `corrections/${data.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await admin.storage
        .from("criminal-history-documents")
        .upload(supportingDocumentPath, support, { contentType: support.type, upsert: false });
      if (!uploadError) await admin.from("criminal_history_correction_requests").update({ supporting_document_path: supportingDocumentPath }).eq("id", data.id);
    }
  }

  redirect(`/antecedentes/correccion?submitted=1&request=${encodeURIComponent(data.request_number)}`);
}

export async function recordFinalCaseDisposition(formData: FormData) {
  const parsed = finalDispositionSchema.safeParse(Object.fromEntries(formData));
  const caseId = String(formData.get("case_id") || "");
  if (!parsed.success) redirect(`/admin/expedientes/${caseId}/disposicion-final?error=${encodeURIComponent(parsed.error.issues[0].message)}`);

  const supabase = await createClient();
  if (!supabase) redirect(`/admin/expedientes/${parsed.data.case_id}/disposicion-final?error=Supabase%20no%20configurado`);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sentence = {
    imprisonment: parsed.data.imprisonment?.trim() || null,
    probation: parsed.data.probation?.trim() || null,
    supervised_release: parsed.data.supervised_release?.trim() || null,
    fine_amount: parsed.data.fine_amount?.trim() || null,
    restitution_amount: parsed.data.restitution_amount?.trim() || null,
    forfeiture: parsed.data.forfeiture?.trim() || null,
    community_service: parsed.data.community_service?.trim() || null,
    special_assessment: parsed.data.special_assessment?.trim() || null,
    concurrent_or_consecutive: parsed.data.concurrent_or_consecutive?.trim() || null,
    other_conditions: parsed.data.other_conditions?.trim() || null,
    active_supervision: parsed.data.active_supervision === "on",
  };

  const { data, error } = await supabase.rpc("record_final_case_disposition", {
    p_case_id: parsed.data.case_id,
    p_person_id: parsed.data.person_id && parsed.data.person_id !== "new" ? parsed.data.person_id : null,
    p_legal_first_name: parsed.data.legal_first_name?.trim() || null,
    p_legal_middle_name: parsed.data.legal_middle_name?.trim() || null,
    p_legal_last_name: parsed.data.legal_last_name?.trim() || null,
    p_date_of_birth: normalizeDate(parsed.data.date_of_birth),
    p_count_number: parsed.data.count_number ?? null,
    p_statute_citation: parsed.data.statute_citation.trim(),
    p_offense_title: parsed.data.offense_title.trim(),
    p_offense_level: parsed.data.offense_level || null,
    p_charging_instrument: parsed.data.charging_instrument || null,
    p_disposition_type: parsed.data.disposition_type,
    p_disposition_date: parsed.data.disposition_date,
    p_judgment_date: normalizeDate(parsed.data.judgment_date),
    p_sentence: sentence,
    p_access_classification: parsed.data.access_classification,
    p_certification: parsed.data.certification.trim(),
  });

  if (error || !data) redirect(`/admin/expedientes/${parsed.data.case_id}/disposicion-final?error=${encodeURIComponent(error?.message || "No fue posible registrar la disposición")}`);
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  redirect(`/admin/expedientes/${parsed.data.case_id}?disposition=1`);
}
