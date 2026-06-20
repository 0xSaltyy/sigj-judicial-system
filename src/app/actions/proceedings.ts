"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseAccess, RESOURCE_ROLES } from "@/lib/auth/permissions";
import { TEMPLATE_STYLES } from "@/lib/document-templates";
import { dbUuid } from "@/lib/validation";

const schema = z.object({
  id: dbUuid.optional().or(z.literal("")), case_id: dbUuid, type: z.string().trim().min(2),
  custom_type: z.string().trim().max(160).optional(),
  title: z.string().trim().max(180), chamber: z.string().trim().max(180), content_markdown: z.string().trim().max(100000),
  status: z.enum(["Borrador", "En revisión"]), visibility: z.enum(["public", "internal", "reserved"]),
  creation_mode: z.enum(["editor", "pdf", "mixed"]), providence_date: z.string().optional(), requires_signature: z.string().optional(),
  template_key: z.string().trim().max(100).optional(), template_style: z.enum(TEMPLATE_STYLES),
  custom_template_name: z.string().trim().max(160).optional(),
  document_code: z.string().trim().max(80).optional(), act_number: z.string().trim().max(80).optional(),
  city: z.string().trim().max(120).optional(), room_name: z.string().trim().max(180).optional(),
  rapporteur_name: z.string().trim().max(180).optional(), secretary_name: z.string().trim().max(180).optional(),
  claimant_name: z.string().trim().max(240).optional(), defendant_name: z.string().trim().max(240).optional(),
  linked_party_name: z.string().trim().max(240).optional(), subject: z.string().trim().max(300).optional(),
  footnotes: z.string().trim().max(5000).optional(),
}).superRefine((value, context) => {
  if (value.type === "__other" && (!value.custom_type || value.custom_type.length < 2)) context.addIssue({ code: "custom", path: ["custom_type"], message: "Especifique el tipo de providencia" });
  if (value.status !== "Borrador" && (value.title.length < 3 || value.chamber.length < 2)) context.addIssue({ code: "custom", message: "Título y despacho son obligatorios para enviar a revisión" });
  if (value.creation_mode === "editor" && value.content_markdown.length < 20) context.addIssue({ code: "custom", path: ["content_markdown"], message: "La providencia redactada debe tener al menos 20 caracteres" });
  if (value.creation_mode !== "pdf" && !value.template_key) context.addIssue({ code: "custom", path: ["template_key"], message: "Seleccione una plantilla de contenido" });
  if (value.creation_mode !== "pdf" && value.template_key === "custom" && (!value.custom_template_name || value.custom_template_name.length < 2)) context.addIssue({ code: "custom", path: ["custom_template_name"], message: "Especifique el nombre de la plantilla personalizada" });
});

function fail(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}`); }

export async function createProceeding(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const rawId = String(formData.get("id") || "");
  const errorPath = rawId ? `/admin/providencias/${rawId}/editar` : "/admin/providencias/nueva";
  if (!parsed.success) fail(errorPath, parsed.error.issues[0].message);
  const { supabase, user } = await requireCaseAccess(parsed.data.case_id, RESOURCE_ROLES.proceedingsWrite);
  const [{ data: caseRecord }, { data: existing }] = await Promise.all([
    supabase.from("cases").select("confidentiality_level,public_visibility,archived_at").eq("id", parsed.data.case_id).maybeSingle(),
    parsed.data.id ? supabase.from("proceedings").select("id,status,pdf_path,case_id").eq("id", parsed.data.id).eq("case_id", parsed.data.case_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!caseRecord || caseRecord.archived_at) fail(errorPath, "El expediente no está disponible");
  if (parsed.data.id && (!existing || !["Borrador", "En revisión"].includes(existing.status))) fail(errorPath, "Sólo puede reemplazar un borrador o documento en revisión");
  if (parsed.data.visibility === "public" && (caseRecord.confidentiality_level !== "Público" || !caseRecord.public_visibility)) fail(errorPath, "Un expediente reservado no puede tener providencias públicas");

  const file = formData.get("pdf_file");
  const pdf = file instanceof File && file.size > 0 ? file : null;
  if (pdf) {
    const header = Buffer.from(await pdf.slice(0, 5).arrayBuffer()).toString("ascii");
    const acceptedType = !pdf.type || pdf.type === "application/pdf";
    if (!acceptedType || header !== "%PDF-" || pdf.size > 50 * 1024 * 1024)
      fail(errorPath, "Seleccione un PDF válido de hasta 50 MB");
  }
  if (!parsed.data.id && parsed.data.creation_mode === "pdf" && !pdf) fail(errorPath, "Seleccione el PDF de la providencia");
  if (parsed.data.creation_mode !== "editor" && !pdf && !existing?.pdf_path) fail(errorPath, "El modo PDF requiere un archivo adjunto");

  const id = parsed.data.id || crypto.randomUUID();
  const documentType = parsed.data.type === "__other" ? parsed.data.custom_type! : parsed.data.type;
  let newPath: string | null = null;
  if (pdf) {
    const safeName = pdf.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_");
    newPath = `${parsed.data.case_id}/${id}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("providence-files").upload(newPath, pdf, { contentType: "application/pdf", upsert: false });
    if (error) fail(errorPath, error.message);
  }
  const payload = {
    case_id: parsed.data.case_id, type: documentType, title: parsed.data.title || "Providencia sin título",
    chamber: parsed.data.chamber || "Despacho por definir", content_markdown: parsed.data.content_markdown || "# Documento PDF adjunto\n",
    status: parsed.data.status, visibility: parsed.data.visibility, creation_mode: parsed.data.creation_mode,
    providence_date: parsed.data.providence_date || new Date().toISOString().slice(0, 10), requires_signature: parsed.data.requires_signature === "true",
    template_key: parsed.data.creation_mode === "pdf" ? null : parsed.data.template_key || "blank",
    template_style: parsed.data.template_style,
    document_metadata: {
      customTemplateName: parsed.data.custom_template_name || null,
      documentCode: parsed.data.document_code || null,
      actNumber: parsed.data.act_number || null,
      city: parsed.data.city || null,
      roomName: parsed.data.room_name || null,
      rapporteurName: parsed.data.rapporteur_name || null,
      secretaryName: parsed.data.secretary_name || null,
      claimantName: parsed.data.claimant_name || null,
      defendantName: parsed.data.defendant_name || null,
      linkedPartyName: parsed.data.linked_party_name || null,
      subject: parsed.data.subject || null,
      footnotes: parsed.data.footnotes || null,
    },
    ...(pdf ? { pdf_path: newPath, pdf_original_name: pdf.name, pdf_size_bytes: pdf.size } : {}),
  };
  let result;
  if (parsed.data.id) result = await supabase.from("proceedings").update(payload).eq("id", id).eq("case_id", parsed.data.case_id).is("archived_at", null).select("id").single();
  else {
    const { data: number, error: numberError } = await supabase.rpc("generate_providence_number", { p_prefix: documentType.slice(0, 3).toUpperCase() });
    if (numberError || !number) { if (newPath) await supabase.storage.from("providence-files").remove([newPath]); fail(errorPath, numberError?.message ?? "No fue posible generar el número"); }
    result = await supabase.from("proceedings").insert({ id, ...payload, providence_number: number, judge_id: user.id, created_by: user.id }).select("id").single();
  }
  if (result.error || !result.data) { if (newPath) await supabase.storage.from("providence-files").remove([newPath]); fail(errorPath, result.error?.message ?? "No fue posible guardar"); }
  if (newPath && existing?.pdf_path && existing.pdf_path !== newPath) await supabase.storage.from("providence-files").remove([existing.pdf_path]);
  await supabase.rpc("log_security_event", { p_action: pdf ? (existing?.pdf_path ? "PROVIDENCE_PDF_REPLACED" : "PROVIDENCE_PDF_UPLOADED") : "PROVIDENCE_SAVED", p_table: "proceedings", p_record_id: id, p_description: "Providencia guardada", p_metadata: { creation_mode: parsed.data.creation_mode, has_pdf: Boolean(newPath || existing?.pdf_path), requires_signature: parsed.data.requires_signature === "true" } });
  revalidatePath("/admin/providencias"); revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  redirect(`/admin/providencias/${id}?success=${encodeURIComponent("Providencia guardada")}`);
}

export async function publishProceeding(formData: FormData) {
  const parsed = z.object({ id: dbUuid, case_id: dbUuid }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/providencias?error=Providencia%20no%20válida");
  const { supabase, user } = await requireCaseAccess(parsed.data.case_id, RESOURCE_ROLES.proceedingsWrite);
  const [{ data: proceeding }, { data: caseRecord }] = await Promise.all([
    supabase.from("proceedings").select("id,title,chamber,content_markdown,visibility,archived_at,creation_mode,pdf_path,requires_signature,providence_date").eq("id", parsed.data.id).eq("case_id", parsed.data.case_id).maybeSingle(),
    supabase.from("cases").select("confidentiality_level,public_visibility,archived_at").eq("id", parsed.data.case_id).maybeSingle(),
  ]);
  const path = `/admin/providencias/${parsed.data.id}`;
  if (!proceeding || proceeding.archived_at || !caseRecord || caseRecord.archived_at) fail(path, "La providencia o su expediente no están disponibles");
  if (proceeding.title.trim().length < 3 || proceeding.chamber.trim().length < 2 || !proceeding.providence_date || (proceeding.creation_mode === "editor" && proceeding.content_markdown.trim().length < 20) || (proceeding.creation_mode !== "editor" && !proceeding.pdf_path)) fail(`${path}/editar`, "Complete título, fecha, despacho y contenido o PDF antes de publicar");
  if (proceeding.visibility === "public" && (caseRecord.confidentiality_level !== "Público" || !caseRecord.public_visibility)) fail(path, "Una providencia reservada no puede publicarse en el portal público");
  const { count } = await supabase.from("signatures").select("id", { count: "exact", head: true }).eq("target_type", "proceeding").eq("target_id", parsed.data.id).eq("status", "signed");
  if (proceeding.requires_signature && !count) fail(path, "Esta providencia requiere al menos una firma antes de publicarse");
  const now = new Date().toISOString();
  const { error } = await supabase.from("proceedings").update({ status: "Publicado", published_at: now, signed_at: count ? now : null, signed_by: count ? user.id : null }).eq("id", parsed.data.id).eq("case_id", parsed.data.case_id).is("archived_at", null);
  if (error) fail(path, error.message);
  await supabase.rpc("log_security_event", { p_action: "PROVIDENCE_PUBLISHED", p_table: "proceedings", p_record_id: parsed.data.id, p_description: "Providencia publicada después de validar metadatos y firmas", p_metadata: { signature_count: count ?? 0, visibility: proceeding.visibility } });
  revalidatePath("/admin/providencias"); revalidatePath(`/providencias/${parsed.data.id}`);
  redirect(`${path}?success=${encodeURIComponent("Providencia publicada")}`);
}
