"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { caseNumberPrefix, isMatterContext, type FederalCaseCategory, type RecordContext } from "@/lib/federal-model";

const recordContextValues = [
  "matter",
  "criminal_investigation",
  "federal_case",
  "existing_case_proceeding",
  "appeal",
  "warrant_request",
  "administrative_request",
] as const;

const caseCategoryValues = [
  "Civil",
  "Criminal",
  "Magistrate Judge proceeding",
  "Miscellaneous",
  "Bankruptcy",
  "Adversary proceeding",
  "Appeal",
  "Supreme Court proceeding",
  "Specialized federal proceeding",
] as const;

const accessLevelValues = ["Public", "Restricted", "Sealed", "Grand-jury restricted", "Internal DOJ only"] as const;

const participantSchema = z.object({
  legal_name: z.string().min(1),
  display_name: z.string().optional(),
  person_or_organization: z.enum(["person", "organization", "agency"]).default("person"),
  role_code: z.string().min(1),
  side: z.string().optional(),
  counsel: z.string().optional(),
  government_agency: z.string().optional(),
  sealed: z.boolean().optional(),
  minor: z.boolean().optional(),
  pseudonym: z.boolean().optional(),
  notes: z.string().optional(),
});

const federalRecordSchema = z.object({
  record_context: z.enum(recordContextValues),
  title: z.string().min(3, "Ingrese un título"),
  summary: z.string().min(20, "El resumen debe tener al menos 20 caracteres"),
  filed_at: z.string().min(1, "Ingrese la fecha de apertura"),
  federal_access_level: z.enum(accessLevelValues),
  public_visibility: z.string().optional(),
  sealed: z.string().optional(),
  grand_jury_restricted: z.string().optional(),

  matter_category: z.string().optional(),
  matter_type: z.string().optional(),
  matter_status: z.string().optional(),
  lead_component: z.string().optional(),
  participating_components: z.string().optional(),
  investigating_agency: z.string().optional(),
  referring_agency: z.string().optional(),
  referral_date: z.string().optional(),
  statutes_under_review: z.string().optional(),
  jurisdiction: z.string().optional(),
  investigative_district: z.string().optional(),
  access_restrictions: z.string().optional(),
  limitation_deadlines: z.string().optional(),
  closing_reason: z.string().optional(),

  court_id: z.string().uuid().optional().or(z.literal("")),
  court_division_id: z.string().uuid().optional().or(z.literal("")),
  case_category: z.enum(caseCategoryValues).optional(),
  case_caption: z.string().optional(),
  docket_number: z.string().optional(),
  originating_court_or_agency: z.string().optional(),
  originating_case_number: z.string().optional(),
  originating_docket_number: z.string().optional(),
  appellate_docket_number: z.string().optional(),
  requested_relief: z.string().optional(),

  nature_of_suit_code: z.string().optional(),
  cause_of_action: z.string().optional(),
  basis_of_jurisdiction: z.string().optional(),
  plaintiff_citizenship: z.string().optional(),
  defendant_citizenship: z.string().optional(),
  amount_in_controversy: z.string().optional(),
  origin_code: z.string().optional(),
  jury_demand: z.string().optional(),
  class_action: z.string().optional(),
  related_case_indicator: z.string().optional(),
  multidistrict_litigation_indicator: z.string().optional(),
  county_of_residence: z.string().optional(),
  summons_requested: z.string().optional(),
  filing_fee_status: z.string().optional(),
  ifp_requested: z.string().optional(),

  charging_instrument: z.string().optional(),
  complaint_number: z.string().optional(),
  indictment_number: z.string().optional(),
  offense_statutes: z.string().optional(),
  counts: z.string().optional(),
  offense_description: z.string().optional(),
  offense_level: z.string().optional(),
  arrest_status: z.string().optional(),
  custody_status: z.string().optional(),
  grand_jury_status: z.string().optional(),
  prosecuting_office: z.string().optional(),
  lead_ausa: z.string().optional(),
  disposition: z.string().optional(),

  notice_of_appeal_date: z.string().optional(),
  appellate_basis: z.string().optional(),
  cross_appeal: z.string().optional(),
  agency_review: z.string().optional(),
  supreme_court_petition_status: z.string().optional(),

  participants_json: z.string().optional(),
  attachment_title: z.string().optional(),
});

type FederalRecordInput = z.infer<typeof federalRecordSchema>;
type ParticipantInput = z.infer<typeof participantSchema>;
type ActorProfile = { id: string; role: string; is_active: boolean };
type CourtRecord = {
  id: string;
  official_name: string;
  abbreviation: string;
  court_system: string;
  court_level: string;
  district: string | null;
  state_or_territory: string | null;
  accepted_case_categories: string[];
};
type DivisionRecord = { id: string; court_id: string; name: string; courthouse_name: string | null; clerk_office: string | null };

const staffRoles = new Set([
  "SUPER_ADMIN",
  "OWNER",
  "ATTORNEY_GENERAL",
  "DEPUTY_ATTORNEY_GENERAL",
  "JUEZ",
  "FISCAL",
  "ABOGADO",
  "SECRETARIO",
  "SECRETARIA",
  "SECRETARIO_GENERAL",
  "SECRETARIO_DESPACHO",
  "INVESTIGADOR",
  "ADMINISTRADOR",
  "PERSONAL_AUTORIZADO",
  "RADICADOR",
  "REPARTO",
]);

function checkbox(value?: string) {
  return value === "on" || value === "true" || value === "1";
}

function optionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function splitList(value?: string | null) {
  return (value ?? "")
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseParticipants(value?: string): ParticipantInput[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => participantSchema.safeParse(item))
      .filter((result): result is z.ZodSafeParseSuccess<ParticipantInput> => result.success)
      .map((result) => result.data);
  } catch {
    return [];
  }
}

function accessToLegacyConfidentiality(level: FederalRecordInput["federal_access_level"]) {
  if (level === "Public") return "Público";
  if (level === "Sealed" || level === "Grand-jury restricted") return "Confidencial";
  return "Reservado";
}

function caseCategoryFor(data: FederalRecordInput): FederalCaseCategory {
  if (data.record_context === "appeal") return "Appeal";
  if (data.record_context === "warrant_request") return "Magistrate Judge proceeding";
  if (data.record_context === "existing_case_proceeding") return "Miscellaneous";
  return data.case_category ?? "Civil";
}

function caseRecordContext(data: FederalRecordInput) {
  if (data.record_context === "appeal") return "appeal";
  if (data.record_context === "existing_case_proceeding") return "existing_case_proceeding";
  if (data.record_context === "warrant_request") return "magistrate_proceeding";
  if (data.case_category === "Bankruptcy") return "bankruptcy";
  if (data.case_category === "Specialized federal proceeding") return "specialized";
  return "federal_case";
}

function roleName(participants: ParticipantInput[], roles: string[], fallback: string) {
  return participants.find((participant) => roles.includes(participant.role_code))?.legal_name ?? fallback;
}

function validateServerSide(data: FederalRecordInput, participants: ParticipantInput[], court?: CourtRecord | null, division?: DivisionRecord | null) {
  const context = data.record_context as RecordContext;
  const isMatter = isMatterContext(context);
  const category = caseCategoryFor(data);
  const sealed = checkbox(data.sealed) || data.federal_access_level === "Sealed";
  const grandJuryRestricted = checkbox(data.grand_jury_restricted) || data.federal_access_level === "Grand-jury restricted";

  if (!isMatter && !court) return "Seleccione un tribunal federal para el Case.";
  if (!isMatter && optionalText(data.court_division_id) && (!division || division.court_id !== court?.id)) return "La división seleccionada no pertenece al tribunal federal.";
  if (optionalText(data.docket_number) && !court) return "Un Docket Number solo puede registrarse después de seleccionar tribunal.";
  if (court && !court.accepted_case_categories.includes(category)) return "El tribunal seleccionado no acepta esa Case Category.";
  if (category === "Appeal" && !optionalText(data.originating_case_number) && !optionalText(data.originating_docket_number) && !optionalText(data.originating_court_or_agency)) return "La apelación requiere tribunal/agencia o número de origen.";
  if (category === "Civil" && optionalText(data.charging_instrument)) return "Un Civil Case no puede usar indictment ni charging instrument.";
  if (category === "Criminal" && optionalText(data.nature_of_suit_code)) return "Un Criminal Case no puede usar Nature of Suit civil.";
  if (category !== "Civil" && optionalText(data.nature_of_suit_code)) return "Nature of Suit solo aplica a Civil Cases.";
  if (category !== "Criminal" && category !== "Magistrate Judge proceeding" && optionalText(data.grand_jury_status)) return "Grand-jury status solo aplica a investigaciones o Criminal Cases.";
  if (data.public_visibility && (sealed || grandJuryRestricted || data.federal_access_level !== "Public")) return "Un registro sealed, grand-jury restricted o interno no puede marcarse como público.";
  if (category === "Criminal" && participants.some((participant) => ["plaintiff", "defendant_civil", "counterclaimant", "counterdefendant"].includes(participant.role_code))) return "Un Criminal Case no puede usar roles civiles como Plaintiff/Defendant civil.";
  if (category === "Civil" && participants.some((participant) => ["criminal_defendant", "ausa", "defense_counsel", "probation_officer", "pretrial_services"].includes(participant.role_code))) return "Un Civil Case no puede usar roles penales.";
  if (isMatter && category === "Civil" && optionalText(data.docket_number)) return "Un Matter interno no debe recibir Docket Number.";
  return null;
}

async function uploadAttachment(recordId: string, file: FormDataEntryValue | null, userId: string, caseId?: string, matterId?: string) {
  if (!(file instanceof File) || file.size === 0) return;
  const supabase = await createClient();
  if (!supabase) return;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${recordId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("case-documents").upload(path, file, { upsert: false });
  if (uploadError) return;
  const { data: document } = await supabase.from("documents").insert({
    case_id: caseId ?? null,
    uploaded_by: userId,
    title: file.name,
    file_path: path,
    file_type: file.type || "application/octet-stream",
    visibility: "internal",
  }).select("id").single();

  if (document) {
    await supabase.from("filings").insert({
      case_id: caseId ?? null,
      matter_id: matterId ?? null,
      filing_type: "Initial attachment",
      title: file.name,
      filed_by: "DOJ internal user",
      visibility: "internal",
      document_id: document.id,
      created_by: userId,
    });
  }
}

async function insertParticipants(
  participants: ParticipantInput[],
  userId: string,
  link: { caseId?: string; matterId?: string },
) {
  const supabase = await createClient();
  if (!supabase || participants.length === 0) return;

  for (const participant of participants) {
    const { data, error } = await supabase.from("participants").insert({
      person_or_organization: participant.person_or_organization,
      legal_name: participant.legal_name,
      display_name: optionalText(participant.display_name),
      government_agency: optionalText(participant.government_agency),
      sealed: Boolean(participant.sealed),
      minor: Boolean(participant.minor),
      pseudonym: Boolean(participant.pseudonym),
      notes: optionalText(participant.notes),
      created_by: userId,
    }).select("id").single();

    if (error || !data) continue;

    if (link.matterId) {
      await supabase.from("matter_participants").insert({
        matter_id: link.matterId,
        participant_id: data.id,
        role_code: participant.role_code,
        side: optionalText(participant.side),
        notes: optionalText(participant.notes),
      });
    }

    if (link.caseId) {
      await supabase.from("case_participants").insert({
        case_id: link.caseId,
        participant_id: data.id,
        role_code: participant.role_code,
        side: optionalText(participant.side),
        counsel: optionalText(participant.counsel),
        notes: optionalText(participant.notes),
      });
    }
  }
}

async function ensureActor() {
  const supabase = await createClient();
  if (!supabase) redirect(`/admin/expedientes/nuevo?error=${encodeURIComponent("Supabase no está configurado")}`);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await supabase.from("profiles").select("id,role,is_active").eq("id", user.id).single();
  const profile = actor as ActorProfile | null;
  if (!profile?.is_active || !staffRoles.has(String(profile.role))) redirect("/no-autorizado");
  return { supabase, user, actor: profile };
}

export async function createFederalRecord(formData: FormData) {
  const parsed = federalRecordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/expedientes/nuevo?error=${encodeURIComponent(parsed.error.issues[0].message)}`);

  const { supabase, user } = await ensureActor();
  const data = parsed.data;
  const context = data.record_context as RecordContext;
  const participants = parseParticipants(data.participants_json);
  const court = data.court_id
    ? ((await supabase
        .from("federal_courts")
        .select("id,official_name,abbreviation,court_system,court_level,district,state_or_territory,accepted_case_categories")
        .eq("id", data.court_id)
        .maybeSingle()).data as CourtRecord | null)
    : null;
  const division = data.court_division_id
    ? ((await supabase
        .from("court_divisions")
        .select("id,court_id,name,courthouse_name,clerk_office")
        .eq("id", data.court_division_id)
        .maybeSingle()).data as DivisionRecord | null)
    : null;
  const validationError = validateServerSide(data, participants, court, division);
  if (validationError) redirect(`/admin/expedientes/nuevo?error=${encodeURIComponent(validationError)}`);

  if (isMatterContext(context)) {
    const { data: matterNumber } = await supabase.rpc("generate_matter_number_for_date", {
      p_division_code: caseNumberPrefix(context === "criminal_investigation" ? "Criminal" : "Matter"),
      p_opened_at: data.filed_at,
    });
    const stableMatterNumber = typeof matterNumber === "string" && matterNumber ? matterNumber : `RP-MAT-${new Date(data.filed_at).getUTCFullYear()}-${Date.now().toString().slice(-6)}`;
    const { data: matter, error } = await supabase.from("matters").insert({
      matter_number: stableMatterNumber,
      title: data.title,
      summary: data.summary,
      matter_category: data.record_context === "criminal_investigation" ? "Federal criminal investigation" : optionalText(data.matter_category) ?? "Internal DOJ matter",
      matter_type: optionalText(data.matter_type) ?? (data.record_context === "warrant_request" ? "Warrant application review" : "Preliminary inquiry"),
      lead_component: optionalText(data.lead_component) ?? "Office of the Attorney General",
      participating_components: splitList(data.participating_components),
      investigating_agency: optionalText(data.investigating_agency),
      referring_agency: optionalText(data.referring_agency),
      referral_date: optionalText(data.referral_date),
      statutes_under_review: splitList(data.statutes_under_review),
      subjects: participants.filter((participant) => participant.role_code === "subject"),
      targets: participants.filter((participant) => participant.role_code === "target"),
      witnesses: participants.filter((participant) => participant.role_code === "witness"),
      victims: participants.filter((participant) => participant.role_code === "victim"),
      related_entities: participants.filter((participant) => participant.role_code === "related_entity" || participant.person_or_organization !== "person"),
      jurisdiction: optionalText(data.jurisdiction) ?? "United States",
      investigative_district: optionalText(data.investigative_district),
      security_classification: data.federal_access_level,
      access_restrictions: optionalText(data.access_restrictions),
      grand_jury_secret: checkbox(data.grand_jury_restricted) || data.federal_access_level === "Grand-jury restricted",
      limitation_deadlines: splitList(data.limitation_deadlines).map((deadline) => ({ deadline })),
      status: optionalText(data.matter_status) ?? "Intake",
      access_level: accessToLegacyConfidentiality(data.federal_access_level) === "Público" ? "Interno" : accessToLegacyConfidentiality(data.federal_access_level),
      opened_at: data.filed_at,
      closing_reason: optionalText(data.closing_reason),
      legacy_metadata: {
        federal_model: true,
        record_context: data.record_context,
        note: "Created after DOJ federal Matter/Case model reform.",
      },
      created_by: user.id,
    }).select("id,matter_number").single();

    if (error || !matter) redirect(`/admin/expedientes/nuevo?error=${encodeURIComponent(error?.message ?? "No fue posible crear el Matter")}`);

    await Promise.all([
      insertParticipants(participants, user.id, { matterId: matter.id }),
      supabase.from("workflow_events").insert({
        matter_id: matter.id,
        event_scope: data.record_context === "criminal_investigation" ? "criminal_investigation" : "matter",
        event_code: "matter_opened",
        title: "Matter opened",
        description: "Internal DOJ Matter opened. It is not a court Case and no Docket Number was assigned.",
        new_status: optionalText(data.matter_status) ?? "Intake",
        created_by: user.id,
      }),
      uploadAttachment(matter.id, formData.get("attachment"), user.id, undefined, matter.id),
    ]);

    redirect(`/admin/matters/${matter.id}?created=1`);
  }

  const category = caseCategoryFor(data);
  const publicVisibility = checkbox(data.public_visibility) && data.federal_access_level === "Public" && !checkbox(data.sealed) && !checkbox(data.grand_jury_restricted);
  const { data: caseNumber } = await supabase.rpc("generate_case_number_for_date", {
    p_process_type: category,
    p_opened_at: data.filed_at,
  });
  const { data: judicialNumber } = await supabase.rpc("generate_judicial_case_number", { dependency_code: "001" });
  const stableCaseNumber = typeof caseNumber === "string" && caseNumber ? caseNumber : `RP-${caseNumberPrefix(category)}-${new Date(data.filed_at).getUTCFullYear()}-${Date.now().toString().slice(-6)}`;
  const fallbackJudicialNumber = typeof judicialNumber === "string" && judicialNumber ? judicialNumber : `FED-LEGACY-${Date.now()}`;
  const claimantName = roleName(participants, ["plaintiff", "petitioner", "appellant", "united_states"], "United States");
  const defendantName = roleName(participants, ["defendant_civil", "criminal_defendant", "respondent", "appellee"], "To be added");
  const classification =
    category === "Civil" ? optionalText(data.nature_of_suit_code) ?? "Civil Case" :
    category === "Criminal" ? optionalText(data.charging_instrument) ?? "Criminal Case" :
    category === "Appeal" ? optionalText(data.appellate_basis) ?? "Appeal" :
    category;

  const { data: record, error } = await supabase.from("cases").insert({
    internal_number: stableCaseNumber,
    judicial_number: fallbackJudicialNumber,
    case_number: stableCaseNumber,
    docket_number: optionalText(data.docket_number),
    docket_court: court?.official_name ?? null,
    docket_district: court?.district ?? court?.state_or_territory ?? null,
    docket_division: division?.name ?? null,
    filing_status: optionalText(data.docket_number) ? "Docketed by Clerk" : "Awaiting Clerk docketing",
    title: data.title,
    authority_type: "United States Federal Judiciary",
    chamber: court?.official_name ?? "Federal court not assigned",
    process_type: category,
    process_subtype: classification,
    claimant_name: claimantName,
    defendant_name: defendantName,
    summary: data.summary,
    claims: optionalText(data.requested_relief) ?? data.summary,
    amount: data.amount_in_controversy ? Number(data.amount_in_controversy) : null,
    department: "United States",
    municipality: court?.district ?? court?.state_or_territory ?? "Federal forum",
    reception_method: "Federal intake",
    confidentiality_level: accessToLegacyConfidentiality(data.federal_access_level),
    status: category === "Appeal" ? "Notice filed" : optionalText(data.docket_number) ? "Case opened by Clerk" : "Intake",
    public_visibility: publicVisibility,
    filed_at: data.filed_at,
    observations: optionalText(data.access_restrictions),
    created_by: user.id,
    record_context: caseRecordContext(data),
    court_id: data.court_id,
    court_division_id: data.court_division_id || null,
    case_category: category,
    case_caption: optionalText(data.case_caption) ?? `${claimantName} v. ${defendantName}`,
    originating_court_or_agency: optionalText(data.originating_court_or_agency),
    originating_case_number: optionalText(data.originating_case_number),
    originating_docket_number: optionalText(data.originating_docket_number),
    appellate_docket_number: optionalText(data.appellate_docket_number),
    federal_access_level: data.federal_access_level,
    sealed: checkbox(data.sealed) || data.federal_access_level === "Sealed",
    grand_jury_restricted: checkbox(data.grand_jury_restricted) || data.federal_access_level === "Grand-jury restricted",
    legacy_colombian_metadata: {
      federal_model: true,
      legacy_required_columns_populated_for_compatibility: true,
    },
  }).select("id").single();

  if (error || !record) redirect(`/admin/expedientes/nuevo?error=${encodeURIComponent(error?.message ?? "No fue posible crear el Case")}`);

  const detailWrites = [];
  if (category === "Civil") {
    detailWrites.push(supabase.from("civil_case_details").insert({
      case_id: record.id,
      nature_of_suit_code: optionalText(data.nature_of_suit_code),
      cause_of_action: optionalText(data.cause_of_action),
      basis_of_jurisdiction: optionalText(data.basis_of_jurisdiction),
      plaintiff_citizenship: optionalText(data.plaintiff_citizenship),
      defendant_citizenship: optionalText(data.defendant_citizenship),
      amount_in_controversy: data.amount_in_controversy ? Number(data.amount_in_controversy) : null,
      origin_code: data.origin_code ? Number(data.origin_code) : null,
      jury_demand: checkbox(data.jury_demand),
      class_action: checkbox(data.class_action),
      related_case_indicator: checkbox(data.related_case_indicator),
      multidistrict_litigation_indicator: checkbox(data.multidistrict_litigation_indicator),
      county_of_residence: optionalText(data.county_of_residence),
      summons_requested: checkbox(data.summons_requested),
      filing_fee_status: optionalText(data.filing_fee_status),
      ifp_requested: checkbox(data.ifp_requested),
    }));
  }

  if (category === "Criminal" || category === "Magistrate Judge proceeding") {
    detailWrites.push(supabase.from("criminal_case_details").insert({
      case_id: record.id,
      charging_instrument: optionalText(data.charging_instrument),
      complaint_number: optionalText(data.complaint_number),
      indictment_number: optionalText(data.indictment_number),
      offense_statutes: splitList(data.offense_statutes),
      counts: splitList(data.counts).map((count, index) => ({ count: index + 1, description: count })),
      offense_description: optionalText(data.offense_description),
      offense_level: optionalText(data.offense_level),
      arrest_status: optionalText(data.arrest_status),
      custody_status: optionalText(data.custody_status),
      grand_jury_status: optionalText(data.grand_jury_status),
      prosecuting_office: optionalText(data.prosecuting_office),
      lead_ausa: optionalText(data.lead_ausa),
      disposition: optionalText(data.disposition),
    }));
  }

  if (category === "Appeal") {
    detailWrites.push(supabase.from("appeal_details").insert({
      case_id: record.id,
      notice_of_appeal_date: optionalText(data.notice_of_appeal_date),
      appellate_basis: optionalText(data.appellate_basis),
      cross_appeal: checkbox(data.cross_appeal),
      agency_review: checkbox(data.agency_review),
      supreme_court_petition_status: optionalText(data.supreme_court_petition_status),
    }));
  }

  await Promise.all([
    insertParticipants(participants, user.id, { caseId: record.id }),
    supabase.from("case_actions").insert({
      case_id: record.id,
      action_type: "Case opened",
      title: "Federal Case opened",
      description: "The Case was opened in the federal model. Docket entries and DOJ internal activity remain separate.",
      visibility: publicVisibility ? "public" : "internal",
      created_by: user.id,
    }),
    supabase.from("workflow_events").insert({
      case_id: record.id,
      event_scope: category.toLowerCase().replaceAll(" ", "_"),
      event_code: "case_opened",
      title: "Federal Case opened",
      description: "Server-side validation generated the Case Number and preserved Docket Number as a separate court identifier.",
      new_status: category === "Appeal" ? "Notice filed" : "Intake",
      created_by: user.id,
    }),
    uploadAttachment(record.id, formData.get("attachment"), user.id, record.id),
    ...detailWrites,
  ]);

  redirect(`/admin/expedientes/${record.id}?created=1`);
}

export async function createCaseFromMatter(formData: FormData) {
  const matterId = String(formData.get("matter_id") || "");
  const courtId = String(formData.get("court_id") || "");
  const caseCategory = String(formData.get("case_category") || "Criminal");
  const reviewed = checkbox(String(formData.get("confidentiality_reviewed") || ""));
  const caption = optionalText(String(formData.get("case_caption") || ""));
  const { supabase } = await ensureActor();
  if (!matterId || !courtId) redirect(`/admin/matters/${matterId || ""}?error=${encodeURIComponent("Seleccione Matter y tribunal federal")}`);

  const { data, error } = await supabase.rpc("create_federal_case_from_matter", {
    p_matter_id: matterId,
    p_court_id: courtId,
    p_case_category: caseCategory,
    p_selected_participant_ids: [],
    p_metadata: {
      confidentiality_reviewed: reviewed,
      case_caption: caption,
      copied_fields: ["title", "summary", "selected non-restricted participant references"],
    },
  });

  if (error || !data) redirect(`/admin/matters/${matterId}?error=${encodeURIComponent(error?.message ?? "No fue posible abrir el Case desde el Matter")}`);
  redirect(`/admin/expedientes/${data}?created=1`);
}

export const createCase = createFederalRecord;
