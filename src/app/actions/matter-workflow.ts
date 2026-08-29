"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

function splitList(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

async function clientOrRedirect(path: string) {
  const supabase = await createClient();
  if (!supabase) redirect(`${path}?error=${encodeURIComponent("Supabase no está configurado")}`);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

const matterCaseSchema = z.object({
  matter_id: z.string().uuid(),
  case_category: z.string().min(3),
  court_id: z.string().uuid(),
  originating_case_id: z.string().uuid().optional().or(z.literal("")),
  case_caption: z.string().min(3, "Indique el caption del Case"),
  filing_type: z.string().optional(),
  filed_at: z.string().optional(),
  docket_number: z.string().optional(),
  federal_access_level: z.string().min(3),
  matter_next_status: z.string().optional(),
  closing_reason: z.string().optional(),
  closing_date: z.string().optional(),
  review_reason: z.string().optional(),
});

export async function openFederalCaseFromMatter(formData: FormData) {
  const parsed = matterCaseSchema.safeParse(Object.fromEntries(formData));
  const matterId = String(formData.get("matter_id") || "");
  if (!parsed.success) redirect(`/admin/matters/${matterId}/abrir-federal-case?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase = await clientOrRedirect(`/admin/matters/${matterId}/abrir-federal-case`);
  const selectedGroups = [
    "participants",
    "statutes",
    "charges",
    "evidence",
    "warrants",
    "public_complaints",
    "criminal_complaint",
    "documents",
    "timeline_events",
    "assigned_attorneys",
    "investigating_agency",
  ].filter((name) => checked(formData, `transfer_${name}`));

  const { data, error } = await supabase.rpc("create_federal_case_from_matter_v2", {
    p_matter_id: parsed.data.matter_id,
    p_case_category: parsed.data.case_category,
    p_court_id: parsed.data.court_id,
    p_originating_case_id: parsed.data.originating_case_id || null,
    p_case_caption: parsed.data.case_caption,
    p_filing_type: parsed.data.filing_type || "Initial filing",
    p_filed_at: parsed.data.filed_at || new Date().toISOString(),
    p_docket_number: parsed.data.docket_number || null,
    p_federal_access_level: parsed.data.federal_access_level,
    p_transfer: {
      selected_groups: selectedGroups,
      confidentiality_reviewed: checked(formData, "confidentiality_reviewed"),
      plaintiff: String(formData.get("plaintiff") || "United States"),
      defendant: String(formData.get("defendant") || "To be added"),
      relief: String(formData.get("relief") || ""),
    },
    p_matter_next_status: parsed.data.matter_next_status || "Mantener estado actual",
    p_closing_reason: parsed.data.closing_reason || null,
    p_closing_date: parsed.data.closing_date || null,
    p_review_reason: parsed.data.review_reason || null,
  });
  if (error || !data || typeof data !== "object" || !("case_id" in data)) {
    redirect(`/admin/matters/${matterId}/abrir-federal-case?error=${encodeURIComponent(error?.message ?? "No fue posible abrir el Federal Case")}`);
  }
  revalidatePath(`/admin/matters/${matterId}`);
  redirect(`/admin/expedientes/${String(data.case_id)}?created=1`);
}

export async function updateMatterControlled(formData: FormData) {
  const matterId = String(formData.get("matter_id") || "");
  const supabase = await clientOrRedirect(`/admin/matters/${matterId}/editar`);
  const payload = {
    title: String(formData.get("title") || ""),
    summary: String(formData.get("summary") || ""),
    matter_type: String(formData.get("matter_type") || ""),
    lead_component: String(formData.get("lead_component") || ""),
    participating_components: splitList(formData.get("participating_components")),
    investigating_agency: String(formData.get("investigating_agency") || ""),
    referring_agency: String(formData.get("referring_agency") || ""),
    referral_date: String(formData.get("referral_date") || ""),
    statutes_under_review: splitList(formData.get("statutes_under_review")),
    status: String(formData.get("status") || ""),
    access_level: String(formData.get("access_level") || ""),
    security_classification: String(formData.get("security_classification") || ""),
    closing_reason: String(formData.get("closing_reason") || ""),
    closing_date: String(formData.get("closing_date") || ""),
  };
  const { error } = await supabase.rpc("update_matter_controlled", {
    p_matter_id: matterId,
    p_payload: payload,
    p_reason: String(formData.get("reason") || ""),
  });
  if (error) redirect(`/admin/matters/${matterId}/editar?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/matters/${matterId}`);
  redirect(`/admin/matters/${matterId}?updated=1`);
}

export async function updateFederalCaseControlled(formData: FormData) {
  const caseId = String(formData.get("case_id") || "");
  const supabase = await clientOrRedirect(`/admin/expedientes/${caseId}/editar`);
  const payload = {
    case_number: String(formData.get("case_number") || ""),
    title: String(formData.get("title") || ""),
    summary: String(formData.get("summary") || ""),
    claims: String(formData.get("claims") || ""),
    case_caption: String(formData.get("case_caption") || ""),
    court_id: String(formData.get("court_id") || ""),
    case_category: String(formData.get("case_category") || ""),
    filing_type: String(formData.get("filing_type") || ""),
    docket_number: String(formData.get("docket_number") || ""),
    filed_at: String(formData.get("filed_at") || ""),
    federal_access_level: String(formData.get("federal_access_level") || ""),
    sealed: checked(formData, "sealed"),
    public_visibility: checked(formData, "public_visibility"),
    trial_type: String(formData.get("trial_type") || ""),
    jury_demand: String(formData.get("jury_demand") || ""),
    observations: String(formData.get("observations") || ""),
  };
  const { error } = await supabase.rpc("update_federal_case_controlled", {
    p_case_id: caseId,
    p_payload: payload,
    p_reason: String(formData.get("reason") || ""),
  });
  if (error) redirect(`/admin/expedientes/${caseId}/editar?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/expedientes/${caseId}`);
  redirect(`/admin/expedientes/${caseId}?updated=1`);
}

export async function openMatterFromComplaintAction(formData: FormData) {
  const complaintId = String(formData.get("complaint_id") || "");
  const supabase = await clientOrRedirect(`/admin/denuncias/${complaintId}`);
  const { data, error } = await supabase.rpc("open_matter_from_complaint", {
    p_complaint_id: complaintId,
    p_title: String(formData.get("title") || ""),
    p_summary: String(formData.get("summary") || ""),
    p_matter_type: String(formData.get("matter_type") || "Preliminary inquiry"),
    p_status: String(formData.get("status") || "Under Investigation"),
    p_access_level: String(formData.get("access_level") || "Internal DOJ only"),
    p_include_attachments: checked(formData, "include_attachments"),
    p_reason: String(formData.get("reason") || ""),
  });
  if (error || !data || typeof data !== "object" || !("matter_id" in data)) redirect(`/admin/denuncias/${complaintId}?error=${encodeURIComponent(error?.message ?? "No fue posible abrir el Matter")}`);
  redirect(`/admin/matters/${String(data.matter_id)}?created=1`);
}

export async function linkComplaintToCaseAction(formData: FormData) {
  const complaintId = String(formData.get("complaint_id") || "");
  const supabase = await clientOrRedirect(`/admin/denuncias/${complaintId}`);
  const { error } = await supabase.rpc("link_complaint_to_case", {
    p_complaint_id: complaintId,
    p_case_id: String(formData.get("case_id") || ""),
    p_relationship_type: String(formData.get("relationship_type") || "related_public_complaint"),
    p_reason: String(formData.get("reason") || ""),
  });
  if (error) redirect(`/admin/denuncias/${complaintId}?error=${encodeURIComponent(error.message)}`);
  redirect(`/admin/denuncias/${complaintId}?updated=1`);
}

export async function createEvidenceItemAction(formData: FormData) {
  const matterId = String(formData.get("matter_id") || "");
  const caseId = String(formData.get("case_id") || "");
  const supabase = await clientOrRedirect(matterId ? `/admin/matters/${matterId}/evidence/nuevo` : `/admin/expedientes/${caseId}`);
  const { error } = await supabase.rpc("create_evidence_item", {
    p_payload: {
      matter_id: matterId,
      case_id: caseId,
      complaint_id: String(formData.get("complaint_id") || ""),
      warrant_id: String(formData.get("warrant_id") || ""),
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || ""),
      evidence_type: String(formData.get("evidence_type") || "Document"),
      source: String(formData.get("source") || ""),
      collection_at: String(formData.get("collection_at") || ""),
      collection_location: String(formData.get("collection_location") || ""),
      custodian: String(formData.get("custodian") || ""),
      sha256_hash: String(formData.get("sha256_hash") || ""),
      access_classification: String(formData.get("access_classification") || "Internal DOJ only"),
      privilege_status: String(formData.get("privilege_status") || "Not privileged"),
      grand_jury_status: String(formData.get("grand_jury_status") || "Not grand-jury material"),
      sealed: checked(formData, "sealed"),
      relevance: String(formData.get("relevance") || ""),
      authenticity_status: String(formData.get("authenticity_status") || "Unverified"),
      admissibility_status: String(formData.get("admissibility_status") || "Internal evidence item"),
      tags: splitList(formData.get("tags")),
      notes: String(formData.get("notes") || ""),
      condition: String(formData.get("condition") || ""),
    },
  });
  if (error) redirect(`${matterId ? `/admin/matters/${matterId}/evidence/nuevo` : `/admin/expedientes/${caseId}`}?error=${encodeURIComponent(error.message)}`);
  const id = matterId || caseId;
  redirect(matterId ? `/admin/matters/${id}?evidence=1` : `/admin/expedientes/${id}?evidence=1`);
}

export async function createGrandJuryAction(formData: FormData) {
  const matterId = String(formData.get("matter_id") || "");
  const supabase = await clientOrRedirect(`/admin/matters/${matterId}/grand-jury/nuevo`);
  const { data, error } = await supabase.rpc("create_grand_jury_for_matter", {
    p_matter_id: matterId,
    p_court_id: String(formData.get("court_id") || ""),
    p_payload: Object.fromEntries(formData),
  });
  if (error || !data) redirect(`/admin/matters/${matterId}/grand-jury/nuevo?error=${encodeURIComponent(error?.message ?? "No fue posible crear el Grand Jury")}`);
  redirect(`/admin/matters/${matterId}?grand_jury=1`);
}

export async function createTrialJuryAction(formData: FormData) {
  const caseId = String(formData.get("case_id") || "");
  const supabase = await clientOrRedirect(`/admin/expedientes/${caseId}/trial-jury/nuevo`);
  const { error } = await supabase.rpc("create_trial_jury_for_case", {
    p_case_id: caseId,
    p_payload: Object.fromEntries(formData),
  });
  if (error) redirect(`/admin/expedientes/${caseId}/trial-jury/nuevo?error=${encodeURIComponent(error.message)}`);
  redirect(`/admin/expedientes/${caseId}?trial_jury=1`);
}
