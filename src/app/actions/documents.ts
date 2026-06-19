"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseAccess, RESOURCE_ROLES } from "@/lib/auth/permissions";

const targetSchema = z.object({ case_id: z.string().uuid(), document_id: z.string().uuid().optional() });
const allowedTypes = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"]);
const maxSize = 20 * 1024 * 1024;

function caseRedirect(caseId: string, kind: "error" | "success", message: string): never {
  redirect(`/admin/expedientes/${caseId}?${kind}=${encodeURIComponent(message)}#documentos`);
}

export async function uploadCaseDocuments(formData: FormData) {
  const parsed = targetSchema.pick({ case_id: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/expedientes?error=Expediente%20no%20válido");
  const { supabase, user } = await requireCaseAccess(parsed.data.case_id, [...RESOURCE_ROLES.actionsWrite, ...RESOURCE_ROLES.casesEdit, ...RESOURCE_ROLES.archive]);
  const files = formData.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length) caseRedirect(parsed.data.case_id, "error", "Seleccione al menos un documento");

  for (const file of files) {
    if (!allowedTypes.has(file.type)) caseRedirect(parsed.data.case_id, "error", `Tipo no permitido: ${file.name}`);
    if (file.size > maxSize) caseRedirect(parsed.data.case_id, "error", `${file.name} supera el máximo de 20 MB`);
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${parsed.data.case_id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("case-documents").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) caseRedirect(parsed.data.case_id, "error", `No fue posible subir ${file.name}: ${uploadError.message}`);
    const { error: documentError } = await supabase.from("documents").insert({
      case_id: parsed.data.case_id,
      uploaded_by: user.id,
      title: file.name,
      original_name: file.name,
      file_path: path,
      file_type: file.type,
      size_bytes: file.size,
      visibility: formData.get("visibility") || "internal",
    });
    if (documentError) {
      await supabase.storage.from("case-documents").remove([path]);
      caseRedirect(parsed.data.case_id, "error", `No fue posible registrar ${file.name}: ${documentError.message}`);
    }
  }
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  caseRedirect(parsed.data.case_id, "success", `${files.length} documento(s) cargado(s)`);
}

export async function deleteDocument(formData: FormData) {
  const parsed = targetSchema.required({ document_id: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/expedientes?error=Documento%20no%20válido");
  const { supabase } = await requireCaseAccess(parsed.data.case_id, [...RESOURCE_ROLES.actionsWrite, ...RESOURCE_ROLES.casesEdit, ...RESOURCE_ROLES.archive]);
  const { data: document } = await supabase.from("documents").select("id,file_path").eq("id", parsed.data.document_id).eq("case_id", parsed.data.case_id).maybeSingle();
  if (!document) caseRedirect(parsed.data.case_id, "error", "Documento no encontrado");
  const { error: storageError } = await supabase.storage.from("case-documents").remove([document.file_path]);
  if (storageError) caseRedirect(parsed.data.case_id, "error", storageError.message);
  const { error } = await supabase.from("documents").delete().eq("id", document.id);
  if (error) caseRedirect(parsed.data.case_id, "error", error.message);
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  caseRedirect(parsed.data.case_id, "success", "Documento eliminado");
}
