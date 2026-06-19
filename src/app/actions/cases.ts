"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseAccess, requirePermission, RESOURCE_ROLES } from "@/lib/auth/permissions";

const caseSchema = z.object({
  authority_type: z.string().trim().min(1), chamber: z.string().trim().min(1), process_type: z.string().trim().min(1), process_subtype: z.string().trim().min(1),
  claimant_name: z.string().trim().min(3, "La parte solicitante es obligatoria"), defendant_name: z.string().trim().min(3, "La parte convocada es obligatoria"),
  claimant_document: z.string().trim().max(80).optional(), defendant_document: z.string().trim().max(80).optional(),
  summary: z.string().trim().min(20, "El resumen debe tener al menos 20 caracteres"), claims: z.string().trim().min(10),
  department: z.string().trim().min(1), municipality: z.string().trim().min(1), reception_method: z.string().trim().min(1),
  confidentiality_level: z.enum(["Público", "Reservado", "Confidencial"]), filed_at: z.string().min(1), amount: z.string().optional(), observations: z.string().trim().max(2000).optional(),
  dependency_id: z.string().uuid("Seleccione una dependencia destino"),
});
const updateSchema = z.object({
  case_id: z.string().uuid(), status: z.string().trim().min(2).max(100), observations: z.string().trim().max(2000).optional(),
  assigned_judge_id: z.string().uuid().optional().or(z.literal("")), dependency_id: z.string().uuid(),
});
const allowedTypes = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"]);

function errorRedirect(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}`); }

export async function createCase(formData: FormData) {
  const parsed = caseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) errorRedirect("/admin/expedientes/nuevo", parsed.error.issues[0].message);
  const { supabase, user } = await requirePermission(RESOURCE_ROLES.casesCreate);
  const { data: dependency } = await supabase.from("dependencies").select("id,code,name,is_active").eq("id", parsed.data.dependency_id).maybeSingle();
  if (!dependency?.is_active) errorRedirect("/admin/expedientes/nuevo", "La dependencia destino no está activa");
  const [{ data: internalNumber, error: internalError }, { data: judicialNumber, error: judicialError }] = await Promise.all([
    supabase.rpc("generate_internal_case_number", { institution_code: dependency.code }),
    supabase.rpc("generate_judicial_case_number", { dependency_code: dependency.code }),
  ]);
  if (internalError || judicialError || !internalNumber || !judicialNumber) errorRedirect("/admin/expedientes/nuevo", internalError?.message ?? judicialError?.message ?? "No fue posible generar la numeración");

  const payload = {
    authority_type: parsed.data.authority_type, chamber: parsed.data.chamber, process_type: parsed.data.process_type, process_subtype: parsed.data.process_subtype,
    claimant_name: parsed.data.claimant_name, defendant_name: parsed.data.defendant_name, summary: parsed.data.summary, claims: parsed.data.claims,
    amount: parsed.data.amount ? Number(parsed.data.amount) : null, department: parsed.data.department, municipality: parsed.data.municipality,
    reception_method: parsed.data.reception_method, confidentiality_level: parsed.data.confidentiality_level, filed_at: new Date(`${parsed.data.filed_at}T12:00:00Z`).toISOString(),
    observations: parsed.data.observations || null, title: `${parsed.data.process_type} · ${parsed.data.process_subtype}`,
    internal_number: internalNumber, judicial_number: judicialNumber, dependency_id: dependency.id, status: "Radicado",
    public_visibility: parsed.data.confidentiality_level === "Público", created_by: user.id,
  };
  const { data: record, error } = await supabase.from("cases").insert(payload).select("id").single();
  if (error || !record) errorRedirect("/admin/expedientes/nuevo", error?.message ?? "No fue posible radicar");

  const childOperations = await Promise.all([
    supabase.from("case_parties").insert([
      { case_id: record.id, name: parsed.data.claimant_name, party_type: "Solicitante", document_number: parsed.data.claimant_document || null },
      { case_id: record.id, name: parsed.data.defendant_name, party_type: "Convocada", document_number: parsed.data.defendant_document || null },
    ]),
    supabase.from("case_actions").insert({ case_id: record.id, action_type: "Radicación", title: "Radicación del expediente", description: `Expediente recibido y asignado inicialmente a ${dependency.name}.`, visibility: parsed.data.confidentiality_level === "Público" ? "public" : "internal", created_by: user.id }),
    supabase.from("radications").insert({ case_id: record.id, received_by: user.id, reception_method: parsed.data.reception_method, validation_status: "Validado", validated_at: new Date().toISOString(), destination_dependency_id: dependency.id }),
  ]);
  const childError = childOperations.find((result) => result.error)?.error;
  if (childError) errorRedirect(`/admin/expedientes/${record.id}`, `Expediente creado, pero un registro relacionado falló: ${childError.message}`);

  const files = formData.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
  for (const file of files) {
    if (!allowedTypes.has(file.type) || file.size > 20 * 1024 * 1024) errorRedirect(`/admin/expedientes/${record.id}`, `${file.name} no cumple los requisitos de archivo`);
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${record.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("case-documents").upload(path, file, { contentType: file.type });
    if (uploadError) errorRedirect(`/admin/expedientes/${record.id}`, uploadError.message);
    const { error: documentError } = await supabase.from("documents").insert({ case_id: record.id, uploaded_by: user.id, title: file.name, original_name: file.name, file_path: path, file_type: file.type, size_bytes: file.size, visibility: "internal" });
    if (documentError) { await supabase.storage.from("case-documents").remove([path]); errorRedirect(`/admin/expedientes/${record.id}`, documentError.message); }
  }
  redirect(`/admin/expedientes/${record.id}?success=${encodeURIComponent("Expediente radicado correctamente")}`);
}

export async function updateCase(formData: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/expedientes?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase } = await requireCaseAccess(parsed.data.case_id, RESOURCE_ROLES.casesEdit);
  const { error } = await supabase.from("cases").update({ status: parsed.data.status, observations: parsed.data.observations || null, assigned_judge_id: parsed.data.assigned_judge_id || null, dependency_id: parsed.data.dependency_id }).eq("id", parsed.data.case_id);
  if (error) errorRedirect(`/admin/expedientes/${parsed.data.case_id}`, error.message);
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  redirect(`/admin/expedientes/${parsed.data.case_id}?success=${encodeURIComponent("Expediente actualizado")}`);
}

export async function archiveCase(formData: FormData) {
  const caseId = z.string().uuid().safeParse(formData.get("case_id"));
  if (!caseId.success) redirect("/admin/expedientes?error=Expediente%20no%20válido");
  const { supabase } = await requireCaseAccess(caseId.data, RESOURCE_ROLES.archive);
  const { error } = await supabase.from("cases").update({ archived_at: new Date().toISOString(), status: "Archivado" }).eq("id", caseId.data);
  if (error) errorRedirect(`/admin/expedientes/${caseId.data}`, error.message);
  revalidatePath(`/admin/expedientes/${caseId.data}`);
  redirect(`/admin/expedientes/${caseId.data}?success=${encodeURIComponent("Expediente archivado")}`);
}

export async function generateCertificate(formData: FormData) {
  const caseId = z.string().uuid().safeParse(formData.get("case_id"));
  if (!caseId.success) redirect("/admin/expedientes?error=Expediente%20no%20válido");
  const { supabase, user } = await requireCaseAccess(caseId.data, [...RESOURCE_ROLES.secretarialWrite, ...RESOURCE_ROLES.archive]);
  const { data: record } = await supabase.from("cases").select("internal_number,judicial_number,filed_at").eq("id", caseId.data).maybeSingle();
  if (!record) errorRedirect("/admin/expedientes", "Expediente no encontrado");
  const { data: number, error: numberError } = await supabase.rpc("generate_certificate_number", { p_prefix: "CONST" });
  if (numberError || !number) errorRedirect(`/admin/expedientes/${caseId.data}`, numberError?.message ?? "No fue posible numerar la constancia");
  const { error } = await supabase.from("certificates").insert({ case_id: caseId.data, certificate_number: number, certificate_type: "Constancia de radicación", content: `Se deja constancia de la radicación ${record.internal_number} / ${record.judicial_number}, recibida el ${record.filed_at}.`, issued_by: user.id });
  if (error) errorRedirect(`/admin/expedientes/${caseId.data}`, error.message);
  revalidatePath(`/admin/expedientes/${caseId.data}`);
  redirect(`/admin/expedientes/${caseId.data}/constancia?success=${encodeURIComponent("Constancia generada y auditada")}`);
}
