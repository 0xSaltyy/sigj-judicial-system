"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWarrantTemplate, normalizeWarrantData, warrantTemplates, type WarrantTypeKey } from "@/lib/warrants";

const applicationSchema = z.object({
  application_type: z.enum(["juez", "abogado", "investigador", "personal"]),
  applicant_name: z.string().min(3, "Ingrese el nombre del postulante"),
  contact_info: z.string().max(300).optional(),
  experience: z.string().min(10, "Describa la experiencia"),
  education: z.string().max(1500).optional(),
  statement: z.string().min(20, "Incluya una declaración personal"),
});

const warrantTypeKeys = warrantTemplates.map((template) => template.key) as [WarrantTypeKey, ...WarrantTypeKey[]];

const warrantSchema = z.object({
  intent: z.enum(["draft", "submit"]).default("draft"),
  warrant_type: z.enum(warrantTypeKeys),
  warrant_title: z.string().max(120).optional(),
  case_number: z.string().max(80).optional(),
  court: z.string().min(3, "Ingrese el tribunal"),
  district: z.string().min(3, "Ingrese el distrito"),
  division: z.string().max(120).optional(),
  city_state: z.string().min(3, "Ingrese ciudad y estado"),
  issued_at: z.string().optional(),
  expires_at: z.string().optional(),
  applicant_name: z.string().min(3, "Ingrese el solicitante"),
  applicant_title: z.string().max(120).optional(),
  applicant_agency: z.string().max(160).optional(),
  attorney_name: z.string().max(160).optional(),
  internal_reference: z.string().max(120).optional(),
  target_type: z.string().max(80).optional(),
  target_description: z.string().min(5, "Describa el objeto del warrant"),
  precise_location: z.string().optional(),
  person_name: z.string().optional(),
  alias: z.string().optional(),
  date_of_birth: z.string().optional(),
  physical_description: z.string().optional(),
  last_known_address: z.string().optional(),
  vehicle_description: z.string().optional(),
  vin: z.string().optional(),
  device_identifier: z.string().optional(),
  provider: z.string().optional(),
  account_identifier: z.string().optional(),
  data_period: z.string().optional(),
  probable_cause: z.string().min(10, "Incluya probable cause o fundamento"),
  legal_basis: z.string().min(10, "Incluya hechos que sustentan la solicitud"),
  offenses: z.string().optional(),
  items_to_search: z.string().optional(),
  items_to_seize: z.string().optional(),
  limitations: z.string().optional(),
  execution_window: z.enum(["daytime", "anytime"]).default("daytime"),
  night_execution_reason: z.string().optional(),
  max_execution_days: z.string().optional(),
  notice_delay: z.string().optional(),
  special_instructions: z.string().optional(),
  responsible_officer: z.string().optional(),
  judge_name: z.string().optional(),
  judge_title: z.string().optional(),
  approval_city_state: z.string().optional(),
  approved_at: z.string().optional(),
  return_inventory: z.string().optional(),
  confidentiality: z.enum(["public", "internal", "reserved", "confidential"]).default("internal"),
  observations: z.string().optional(),
});

const warrantRoles = new Set([
  "SUPER_ADMIN",
  "OWNER",
  "ATTORNEY_GENERAL",
  "DEPUTY_ATTORNEY_GENERAL",
  "JUEZ",
  "FISCAL",
  "INVESTIGADOR",
  "ADMINISTRADOR",
  "PERSONAL_AUTORIZADO",
]);

export async function submitRoleplayApplication(formData: FormData) {
  const parsed = applicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/postulaciones?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase = await createClient();
  if (!supabase) redirect("/postulaciones?submitted=demo");
  const { error } = await supabase.from("roleplay_applications").insert({
    ...parsed.data,
    answers: {},
    status: "Recibida",
  });
  if (error) redirect(`/postulaciones?error=${encodeURIComponent("No fue posible recibir la postulación")}`);
  redirect("/postulaciones?submitted=1");
}

export async function createRoleplayWarrant(formData: FormData) {
  const parsed = warrantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/warrants?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase = await createClient();
  if (!supabase) redirect("/admin/warrants?created=demo");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await supabase.from("profiles").select("id,role,is_active").eq("id", user.id).single();
  if (!actor?.is_active || !warrantRoles.has(String(actor.role))) redirect("/no-autorizado");
  const template = getWarrantTemplate(parsed.data.warrant_type);
  const { data: rpcNumber } = await supabase.rpc("next_roleplay_warrant_number", { p_type: parsed.data.warrant_type });
  const warrantNumber = typeof rpcNumber === "string" && rpcNumber
    ? rpcNumber
    : `${template.prefix}-${new Date().getUTCFullYear()}-${Date.now().toString().slice(-6)}`;
  const normalized = normalizeWarrantData({ ...parsed.data, warrant_number: warrantNumber, warrant_title: parsed.data.warrant_title || template.title });
  const status = parsed.data.intent === "submit" ? "Pendiente" : "Borrador";
  const { error } = await supabase.from("roleplay_warrants").insert({
    warrant_number: warrantNumber,
    warrant_type: parsed.data.warrant_type,
    warrant_title: normalized.warrant_title,
    case_number: normalized.case_number || null,
    court: normalized.court,
    district: normalized.district,
    division: normalized.division || null,
    city_state: normalized.city_state,
    applicant_name: normalized.applicant_name || null,
    applicant_title: normalized.applicant_title || null,
    applicant_agency: normalized.applicant_agency || null,
    attorney_name: normalized.attorney_name || null,
    target_type: normalized.target_type || null,
    target_description: normalized.target_description || "",
    reason: normalized.probable_cause || normalized.legal_basis || "",
    legal_basis: normalized.legal_basis || normalized.probable_cause || "",
    expires_at: parsed.data.expires_at || null,
    issued_at: parsed.data.issued_at || null,
    requested_by: actor.id,
    created_by: user.id,
    confidentiality: parsed.data.confidentiality,
    observations: parsed.data.observations || null,
    document_data: normalized,
    inventory: parsed.data.return_inventory ? [{ text: parsed.data.return_inventory, recorded_at: new Date().toISOString() }] : [],
    status,
  });
  if (error) redirect(`/admin/warrants?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/warrants?created=1");
}
