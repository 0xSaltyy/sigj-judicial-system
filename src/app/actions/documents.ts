"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requireCaseAccess } from "@/lib/auth/permissions";
import { dbUuid } from "@/lib/validation";
import { SERVER_ACTION_FILE_MAX_BYTES } from "@/lib/file-limits";

const maxSize = SERVER_ACTION_FILE_MAX_BYTES;
const documentTypes = [
  "Prueba",
  "Anexo",
  "Providencia relacionada",
  "Oficio",
  "Constancia",
  "Acta",
  "Comunicación",
  "Imagen",
  "Otro",
] as const;

const extensions = {
  pdf: ["application/pdf"],
  doc: ["application/msword", "application/octet-stream"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/octet-stream",
  ],
  xls: ["application/vnd.ms-excel", "application/octet-stream"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/octet-stream",
  ],
  txt: ["text/plain", "application/octet-stream"],
  csv: ["text/csv", "text/plain", "application/vnd.ms-excel"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
} as const;

const canonicalMime: Record<keyof typeof extensions, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const targetSchema = z.object({ case_id: dbUuid });
const metadataSchema = z
  .object({
    case_id: dbUuid,
    title: z.string().trim().min(3, "Escriba un título descriptivo").max(180),
    document_type: z.enum(documentTypes),
    custom_type: z.string().trim().max(100).optional(),
    description: z.string().trim().max(2000).optional(),
    visibility: z.enum(["reserved", "internal", "public"]),
    public_confirmed: z.string().optional(),
    document_date: z.string().optional(),
    folios: z.string().optional(),
    source: z.string().trim().max(180).optional(),
  })
  .superRefine((value, context) => {
    if (value.document_type === "Otro" && !value.custom_type)
      context.addIssue({
        code: "custom",
        path: ["custom_type"],
        message: "Indique el tipo de documento",
      });
    if (value.document_date && !/^\d{4}-\d{2}-\d{2}$/.test(value.document_date))
      context.addIssue({
        code: "custom",
        path: ["document_date"],
        message: "La fecha no es válida",
      });
    if (value.folios) {
      const folios = Number(value.folios);
      if (!Number.isInteger(folios) || folios < 1 || folios > 100000)
        context.addIssue({
          code: "custom",
          path: ["folios"],
          message: "Los folios deben ser un número entre 1 y 100.000",
        });
    }
  });

function uploadRedirect(
  caseId: string,
  kind: "error" | "success",
  message: string,
  field?: string,
): never {
  const target =
    kind === "success"
      ? `/admin/expedientes/${caseId}?success=${encodeURIComponent(message)}#documentos`
      : `/admin/expedientes/${caseId}/documentos/nuevo?error=${encodeURIComponent(message)}${field ? `&field=${encodeURIComponent(field)}` : ""}`;
  redirect(target);
}

function startsWith(bytes: Uint8Array, expected: number[]) {
  return expected.every((value, index) => bytes[index] === value);
}

async function validateFileContents(file: File, extension: keyof typeof extensions) {
  const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const executable = startsWith(bytes, [0x4d, 0x5a]) ||
    startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46]) ||
    startsWith(bytes, [0xca, 0xfe, 0xba, 0xbe]) ||
    startsWith(bytes, [0xcf, 0xfa, 0xed, 0xfe]);
  if (executable) return false;
  if (extension === "pdf") return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (extension === "png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (extension === "jpg" || extension === "jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (extension === "webp")
    return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (extension === "docx" || extension === "xlsx") return startsWith(bytes, [0x50, 0x4b]);
  if (extension === "doc" || extension === "xls")
    return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (extension === "txt" || extension === "csv") return !bytes.includes(0);
  return false;
}

function safeFileName(name: string, extension: string) {
  const stem = name.slice(0, -(extension.length + 1))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100) || "documento";
  return `${stem}.${extension}`;
}

export async function uploadCaseDocument(formData: FormData) {
  const target = targetSchema.safeParse({ case_id: formData.get("case_id") });
  if (!target.success)
    redirect("/admin/expedientes?error=Expediente%20no%20válido");

  const session = await requireCaseAccess(
    target.data.case_id,
    PERMISSIONS.documentsUpload,
  );
  if (
    session.record.archived_at &&
    !(session.profile.is_owner && session.profile.role === "SUPER_ADMIN")
  ) {
    await session.supabase.rpc("log_security_event", {
      p_action: "ARCHIVED_CASE_DOCUMENT_UPLOAD_DENIED",
      p_table: "documents",
      p_record_id: target.data.case_id,
      p_description: "Intento de agregar un documento a un expediente archivado",
      p_metadata: { case_id: target.data.case_id },
    });
    uploadRedirect(
      target.data.case_id,
      "error",
      "Solo la cuenta propietaria puede agregar documentos a un expediente archivado",
    );
  }

  const parsed = metadataSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    uploadRedirect(
      target.data.case_id,
      "error",
      `${issue.message}. El archivo debe seleccionarse nuevamente.`,
      String(issue.path[0] ?? "form"),
    );
  }

  if (parsed.data.visibility === "public") {
    const { data: caseVisibility } = await session.supabase
      .from("cases")
      .select("confidentiality_level,public_visibility")
      .eq("id", target.data.case_id)
      .maybeSingle();
    if (
      parsed.data.public_confirmed !== "true" ||
      caseVisibility?.confidentiality_level !== "Público" ||
      !caseVisibility.public_visibility
    ) {
      await session.supabase.rpc("log_security_event", {
        p_action: "DOCUMENT_PUBLICATION_DENIED",
        p_table: "documents",
        p_record_id: null,
        p_description: "Se rechazó la carga pública de un documento sin condiciones de publicación",
        p_metadata: { case_id: target.data.case_id },
      });
      uploadRedirect(
        target.data.case_id,
        "error",
        "La publicación requiere confirmación y un expediente habilitado como público",
        "visibility",
      );
    }
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    uploadRedirect(target.data.case_id, "error", "Seleccione un archivo", "file");
  if (file.name.length > 255)
    uploadRedirect(target.data.case_id, "error", "El nombre del archivo es demasiado largo", "file");
  if (file.size > maxSize)
    uploadRedirect(
      target.data.case_id,
      "error",
      "El archivo supera el máximo permitido de 3 MB",
      "file",
    );

  const extension = file.name.split(".").pop()?.toLowerCase() as keyof typeof extensions | undefined;
  if (!extension || !(extension in extensions))
    uploadRedirect(
      target.data.case_id,
      "error",
      "Formato no permitido. Use PDF, Word, Excel, texto, CSV, PNG, JPG o WEBP",
      "file",
    );
  const declaredType = file.type.toLowerCase();
  if (declaredType && !(extensions[extension] as readonly string[]).includes(declaredType))
    uploadRedirect(
      target.data.case_id,
      "error",
      "El tipo declarado del archivo no coincide con su extensión",
      "file",
    );
  if (!(await validateFileContents(file, extension)))
    uploadRedirect(
      target.data.case_id,
      "error",
      "El contenido del archivo no corresponde a un formato permitido",
      "file",
    );

  const documentId = crypto.randomUUID();
  const fileName = safeFileName(file.name, extension);
  const filePath = `cases/${target.data.case_id}/documents/${documentId}/${fileName}`;
  const contentType = canonicalMime[extension];
  const { error: uploadError } = await session.supabase.storage
    .from("case-documents")
    .upload(filePath, file, { contentType, upsert: false });
  if (uploadError)
    uploadRedirect(
      target.data.case_id,
      "error",
      `No fue posible almacenar el archivo: ${uploadError.message}`,
      "file",
    );

  const { error: documentError } = await session.supabase.rpc(
    "register_case_document",
    {
      p_case_id: target.data.case_id,
      p_document_id: documentId,
      p_title: parsed.data.title,
      p_document_type: parsed.data.document_type,
      p_custom_type: parsed.data.custom_type || null,
      p_description: parsed.data.description || null,
      p_visibility: parsed.data.visibility,
      p_public_confirmed: parsed.data.public_confirmed === "true",
      p_document_date: parsed.data.document_date || null,
      p_folios: parsed.data.folios ? Number(parsed.data.folios) : null,
      p_source: parsed.data.source || null,
      p_original_name: file.name,
      p_file_path: filePath,
      p_file_type: contentType,
      p_size_bytes: file.size,
    },
  );
  if (documentError) {
    const { error: cleanupError } = await session.supabase.storage
      .from("case-documents")
      .remove([filePath]);
    if (cleanupError)
      await session.supabase.rpc("log_security_event", {
        p_action: "STORAGE_CLEANUP_FAILED",
        p_table: "documents",
        p_record_id: documentId,
        p_description: "No fue posible limpiar un archivo cuyo registro documental falló",
        p_metadata: { case_id: target.data.case_id, file_path: filePath },
      });
    uploadRedirect(
      target.data.case_id,
      "error",
      `No fue posible registrar el documento: ${documentError.message}. El archivo debe seleccionarse nuevamente.`,
    );
  }

  revalidatePath(`/admin/expedientes/${target.data.case_id}`);
  uploadRedirect(target.data.case_id, "success", "Documento agregado y auditado");
}

// Compatibility for any older form that still imports the plural action.
export const uploadCaseDocuments = uploadCaseDocument;
