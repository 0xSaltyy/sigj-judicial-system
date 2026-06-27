"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  enforcePermission,
  requireCaseAccess,
  requirePermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { dbUuid } from "@/lib/validation";
import { SERVER_ACTION_FILE_MAX_BYTES } from "@/lib/file-limits";

const caseSchema = z.object({
  ticket_name: z.string().trim().max(120).optional(),
  authority_type: z.string().trim().min(1),
  chamber: z.string().trim().min(1),
  process_type: z.string().trim().min(1),
  process_subtype: z.string().trim().min(1),
  claimant_name: z
    .string()
    .trim()
    .min(3, "La parte solicitante es obligatoria"),
  defendant_name: z.string().trim().max(180).optional(),
  claimant_document: z.string().trim().max(80).optional(),
  defendant_document: z.string().trim().max(80).optional(),
  summary: z
    .string()
    .trim()
    .min(20, "El resumen debe tener al menos 20 caracteres"),
  claims: z.string().trim().max(8000).optional(),
  department: z.string().trim().min(1),
  municipality: z.string().trim().min(1),
  reception_method: z.string().trim().min(1),
  confidentiality_level: z.enum(["Público", "Reservado", "Confidencial"]),
  filed_at: z.string().min(1),
  amount: z.string().optional(),
  observations: z.string().trim().max(2000).optional(),
  dependency_id: dbUuid,
});
const updateSchema = z.object({
  case_id: dbUuid,
  status: z.string().trim().min(2).max(100),
  observations: z.string().trim().max(2000).optional(),
  assigned_judge_id: dbUuid.optional().or(z.literal("")),
  dependency_id: dbUuid,
});
const allowedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);

function errorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createCase(formData: FormData) {
  const parsed = caseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    errorRedirect("/admin/expedientes/nuevo", parsed.error.issues[0].message);
  const session = await requirePermission(
    PERMISSIONS.casesCreate,
  );
  const { supabase, user } = session;
  const files = formData
    .getAll("attachments")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const attachmentBytes = files.reduce((total, file) => total + file.size, 0);
  if (attachmentBytes > SERVER_ACTION_FILE_MAX_BYTES)
    errorRedirect(
      "/admin/expedientes/nuevo",
      "Los anexos superan el máximo total de 3 MB. Radique sin anexos o reduzca la selección.",
    );
  if (files.length)
    await enforcePermission(session, PERMISSIONS.documentsUpload);
  const { data: dependency } = await supabase
    .from("dependencies")
    .select("id,code,name,is_active")
    .eq("id", parsed.data.dependency_id)
    .maybeSingle();
  if (!dependency?.is_active)
    errorRedirect(
      "/admin/expedientes/nuevo",
      "La dependencia destino no está activa",
    );
  const payload = {
    authority_type: parsed.data.authority_type,
    chamber: parsed.data.chamber,
    process_type: parsed.data.process_type,
    process_subtype: parsed.data.process_subtype,
    claimant_name: parsed.data.claimant_name,
    defendant_name: parsed.data.defendant_name || "Por determinar",
    summary: parsed.data.summary,
    claims: parsed.data.claims || "Sin pretensiones adicionales registradas.",
    amount: parsed.data.amount ? Number(parsed.data.amount) : null,
    department: parsed.data.department,
    municipality: parsed.data.municipality,
    reception_method: parsed.data.reception_method,
    confidentiality_level: parsed.data.confidentiality_level,
    filed_at: new Date(`${parsed.data.filed_at}T12:00:00Z`).toISOString(),
    observations: parsed.data.observations || null,
    title: `${parsed.data.process_type} · ${parsed.data.process_subtype}`,
    ticket_name: parsed.data.ticket_name || null,
    dependency_id: dependency.id,
    status: "Radicado",
    public_visibility: parsed.data.confidentiality_level === "Público",
    created_by: user.id,
  };
  const record = { id: crypto.randomUUID() };
  const parties = [
    {
      name: parsed.data.claimant_name,
      party_type: "Solicitante",
      document_number: parsed.data.claimant_document || null,
    },
    ...(parsed.data.defendant_name
      ? [
          {
            name: parsed.data.defendant_name,
            party_type: "Convocada",
            document_number: parsed.data.defendant_document || null,
          },
        ]
      : []),
  ];
  const { data: createdId, error } = await supabase.rpc(
    "create_case_secure",
    {
      p_case_id: record.id,
      p_payload: payload,
      p_parties: parties,
    },
  );
  if (error || createdId !== record.id)
    errorRedirect(
      "/admin/expedientes/nuevo",
      error?.message?.includes("numeración generada ya existe")
        ? "No fue posible asignar un número de radicación único. Intente nuevamente en unos segundos."
        : (error?.message ?? "No fue posible completar la radicación"),
    );
  if (parsed.data.ticket_name) {
    const { error: ticketError } = await supabase.from("cases").update({ ticket_name: parsed.data.ticket_name }).eq("id", record.id);
    if (ticketError) errorRedirect(`/admin/expedientes/${record.id}`, ticketError.message);
    await supabase.rpc("log_security_event", { p_action: "CASE_TICKET_NAME_SET", p_table: "cases", p_record_id: record.id, p_description: "Asunto breve del expediente registrado", p_metadata: { ticket_name: parsed.data.ticket_name } });
  }

  for (const file of files) {
    if (!allowedTypes.has(file.type) || file.size > SERVER_ACTION_FILE_MAX_BYTES)
      errorRedirect(
        `/admin/expedientes/${record.id}`,
        `${file.name} no cumple los requisitos de archivo`,
      );
    const safeName = file.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${record.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("case-documents")
      .upload(path, file, { contentType: file.type });
    if (uploadError)
      errorRedirect(`/admin/expedientes/${record.id}`, uploadError.message);
    const { error: documentError } = await supabase.from("documents").insert({
      case_id: record.id,
      uploaded_by: user.id,
      title: file.name,
      original_name: file.name,
      file_path: path,
      file_type: file.type,
      size_bytes: file.size,
      visibility: "internal",
    });
    if (documentError) {
      await supabase.storage.from("case-documents").remove([path]);
      errorRedirect(`/admin/expedientes/${record.id}`, documentError.message);
    }
  }
  redirect(
    `/admin/expedientes/${record.id}?success=${encodeURIComponent("Expediente radicado correctamente")}`,
  );
}

export async function updateCase(formData: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(
      `/admin/expedientes?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  const session = await requireCaseAccess(
    parsed.data.case_id,
    PERMISSIONS.casesEdit,
  );
  const { supabase } = session;
  const { data: current } = await supabase
    .from("cases")
    .select("dependency_id,assigned_judge_id")
    .eq("id", parsed.data.case_id)
    .maybeSingle();
  if (!current) errorRedirect("/admin/expedientes", "Expediente no encontrado");
  if (current.dependency_id !== parsed.data.dependency_id)
    await enforcePermission(session, PERMISSIONS.casesRepartition, parsed.data.case_id);
  if (current.assigned_judge_id !== (parsed.data.assigned_judge_id || null))
    await enforcePermission(session, PERMISSIONS.casesAssignPonente, parsed.data.case_id);
  const { error } = await supabase
    .from("cases")
    .update({
      status: parsed.data.status,
      observations: parsed.data.observations || null,
      assigned_judge_id: parsed.data.assigned_judge_id || null,
      dependency_id: parsed.data.dependency_id,
    })
    .eq("id", parsed.data.case_id);
  if (error)
    errorRedirect(`/admin/expedientes/${parsed.data.case_id}`, error.message);
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  redirect(
    `/admin/expedientes/${parsed.data.case_id}?success=${encodeURIComponent("Expediente actualizado")}`,
  );
}

const fullUpdateSchema = z.object({
  case_id: dbUuid,
  ticket_name: z.string().trim().max(120).optional(),
  title: z.string().trim().min(3).max(240),
  authority_type: z.string().trim().min(2).max(160),
  chamber: z.string().trim().min(2).max(180),
  process_type: z.string().trim().min(2).max(160),
  process_subtype: z.string().trim().min(2).max(160),
  claimant_name: z.string().trim().min(2).max(180),
  defendant_name: z.string().trim().min(2).max(180),
  summary: z.string().trim().min(20).max(12000),
  claims: z.string().trim().min(2).max(12000),
  department: z.string().trim().min(2).max(120),
  municipality: z.string().trim().min(2).max(120),
  reception_method: z.string().trim().min(2).max(120),
  confidentiality_level: z.enum(["Público", "Reservado", "Confidencial"]),
  public_visibility: z.string().optional(),
  assigned_judge_id: dbUuid.optional().or(z.literal("")),
  dependency_id: dbUuid,
  status: z.string().trim().min(2).max(100),
  observations: z.string().trim().max(4000).optional(),
  declassification_confirmation: z.string().optional(),
});

export async function updateCaseFull(formData: FormData) {
  const parsed = fullUpdateSchema.safeParse(Object.fromEntries(formData));
  const caseId = String(formData.get("case_id") || "");
  if (!parsed.success) redirect(`/admin/expedientes/${caseId}/editar?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const session = await requireCaseAccess(parsed.data.case_id, PERMISSIONS.casesEdit);
  const { supabase } = session;
  const { data: current } = await supabase
    .from("cases")
    .select("dependency_id,assigned_judge_id")
    .eq("id", parsed.data.case_id)
    .maybeSingle();
  if (!current) redirect(`/admin/expedientes/${parsed.data.case_id}/editar?error=Expediente%20no%20encontrado`);
  if (current.dependency_id !== parsed.data.dependency_id)
    await enforcePermission(session, PERMISSIONS.casesRepartition, parsed.data.case_id);
  if (current.assigned_judge_id !== (parsed.data.assigned_judge_id || null))
    await enforcePermission(session, PERMISSIONS.casesAssignPonente, parsed.data.case_id);
  const payload = {
    title: parsed.data.title, ticket_name: parsed.data.ticket_name || "", authority_type: parsed.data.authority_type, chamber: parsed.data.chamber,
    process_type: parsed.data.process_type, process_subtype: parsed.data.process_subtype,
    claimant_name: parsed.data.claimant_name, defendant_name: parsed.data.defendant_name,
    summary: parsed.data.summary, claims: parsed.data.claims, department: parsed.data.department,
    municipality: parsed.data.municipality, reception_method: parsed.data.reception_method,
    confidentiality_level: parsed.data.confidentiality_level,
    public_visibility: parsed.data.confidentiality_level === "Público" && parsed.data.public_visibility === "true",
    assigned_judge_id: parsed.data.assigned_judge_id || "", dependency_id: parsed.data.dependency_id,
    status: parsed.data.status, observations: parsed.data.observations || "",
  };
  const { error } = await supabase.rpc("update_case_secure", { p_case_id: parsed.data.case_id, p_payload: payload, p_declassification_confirmation: parsed.data.declassification_confirmation || null });
  if (error) redirect(`/admin/expedientes/${parsed.data.case_id}/editar?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  redirect(`/admin/expedientes/${parsed.data.case_id}?success=${encodeURIComponent("Expediente actualizado y auditado")}`);
}

const partySchema = z.object({
  party_id: dbUuid.optional().or(z.literal("")), case_id: dbUuid,
  name: z.string().trim().min(2).max(180), party_type: z.string().trim().min(2).max(120),
  document_type: z.string().trim().max(60).optional(), document_number: z.string().trim().max(80).optional(),
  email: z.string().trim().email().optional().or(z.literal("")), phone: z.string().trim().max(60).optional(),
  address: z.string().trim().max(300).optional(), is_confidential: z.string().optional(),
});

export async function saveCaseParty(formData: FormData) {
  const parsed = partySchema.safeParse(Object.fromEntries(formData));
  const caseId = String(formData.get("case_id") || "");
  if (!parsed.success) redirect(`/admin/expedientes/${caseId}/editar?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase } = await requireCaseAccess(parsed.data.case_id, PERMISSIONS.casesEdit);
  const payload = { case_id: parsed.data.case_id, name: parsed.data.name, party_type: parsed.data.party_type, document_type: parsed.data.document_type || null, document_number: parsed.data.document_number || null, email: parsed.data.email || null, phone: parsed.data.phone || null, address: parsed.data.address || null, is_confidential: parsed.data.is_confidential === "true" };
  const result = parsed.data.party_id
    ? await supabase.from("case_parties").update(payload).eq("id", parsed.data.party_id).eq("case_id", parsed.data.case_id).is("archived_at", null)
    : await supabase.from("case_parties").insert(payload);
  if (result.error) redirect(`/admin/expedientes/${parsed.data.case_id}/editar?error=${encodeURIComponent(result.error.message)}`);
  await supabase.rpc("log_security_event", { p_action: parsed.data.party_id ? "CASE_PARTY_UPDATED" : "CASE_PARTY_CREATED", p_table: "case_parties", p_record_id: parsed.data.party_id || parsed.data.case_id, p_description: "Parte procesal actualizada", p_metadata: { case_id: parsed.data.case_id } });
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}/editar`);
  redirect(`/admin/expedientes/${parsed.data.case_id}/editar?success=Parte%20procesal%20guardada`);
}

export async function manageCaseParty(formData: FormData) {
  const parsed = z.object({ party_id: dbUuid, case_id: dbUuid, operation: z.enum(["archive", "restore", "delete"]), confirmation: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/expedientes?error=Parte%20procesal%20no%20válida");
  const { supabase, user, profile } = await requireCaseAccess(parsed.data.case_id, PERMISSIONS.casesEdit);
  if (parsed.data.operation !== "archive" && !profile.is_owner) redirect(`/admin/expedientes/${parsed.data.case_id}/editar?error=Solo%20SUPER_ADMIN%20puede%20restaurar%20o%20eliminar%20partes`);
  if (parsed.data.operation === "delete" && parsed.data.confirmation !== "ELIMINAR DEFINITIVAMENTE") redirect(`/admin/expedientes/${parsed.data.case_id}/editar?error=Confirmación%20de%20eliminación%20incorrecta`);
  const result = parsed.data.operation === "archive"
    ? await supabase.from("case_parties").update({ archived_at: new Date().toISOString(), archived_by: user.id }).eq("id", parsed.data.party_id).eq("case_id", parsed.data.case_id).is("archived_at", null)
    : parsed.data.operation === "restore"
      ? await supabase.from("case_parties").update({ archived_at: null, archived_by: null }).eq("id", parsed.data.party_id).eq("case_id", parsed.data.case_id)
      : await supabase.from("case_parties").delete().eq("id", parsed.data.party_id).eq("case_id", parsed.data.case_id);
  if (result.error) redirect(`/admin/expedientes/${parsed.data.case_id}/editar?error=${encodeURIComponent(result.error.message)}`);
  await supabase.rpc("log_security_event", { p_action: `CASE_PARTY_${parsed.data.operation.toUpperCase()}`, p_table: "case_parties", p_record_id: parsed.data.party_id, p_description: "Ciclo de vida de parte procesal", p_metadata: { operation: parsed.data.operation } });
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}/editar`);
  redirect(`/admin/expedientes/${parsed.data.case_id}/editar?success=Parte%20procesal%20actualizada`);
}

export async function generateCertificate(formData: FormData) {
  const caseId = dbUuid.safeParse(formData.get("case_id"));
  if (!caseId.success)
    redirect("/admin/expedientes?error=Expediente%20no%20válido");
  const { supabase, user } = await requireCaseAccess(
    caseId.data,
    PERMISSIONS.documentsUpload,
  );
  const { data: record } = await supabase
    .from("cases")
    .select("internal_number,judicial_number,filed_at")
    .eq("id", caseId.data)
    .maybeSingle();
  if (!record) errorRedirect("/admin/expedientes", "Expediente no encontrado");
  const { data: number, error: numberError } = await supabase.rpc(
    "generate_certificate_number",
    { p_prefix: "CONST" },
  );
  if (numberError || !number)
    errorRedirect(
      `/admin/expedientes/${caseId.data}`,
      numberError?.message ?? "No fue posible numerar la constancia",
    );
  const { error } = await supabase.from("certificates").insert({
    case_id: caseId.data,
    certificate_number: number,
    certificate_type: "Constancia de radicación",
    content: `Se deja constancia de la radicación ${record.internal_number} / ${record.judicial_number}, recibida el ${record.filed_at}.`,
    issued_by: user.id,
  });
  if (error) errorRedirect(`/admin/expedientes/${caseId.data}`, error.message);
  revalidatePath(`/admin/expedientes/${caseId.data}`);
  redirect(
    `/admin/expedientes/${caseId.data}/constancia?success=${encodeURIComponent("Constancia generada y auditada")}`,
  );
}
