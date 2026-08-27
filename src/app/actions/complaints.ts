"use server";

import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const complaintSchema = z.object({
  anonymous: z.string().optional(),
  complainant_name: z.string().max(160).optional(),
  contact_method: z.string().max(240).optional(),
  category: z.string().min(3, "Seleccione una categoría"),
  reported_subject: z.string().max(240).optional(),
  description: z.string().min(20, "Describa los hechos con más detalle"),
  occurred_on: z.string().optional(),
  location: z.string().max(240).optional(),
  confirmation: z.literal("on", { message: "Debe confirmar que la información es correcta" }),
});

const statusSchema = z.object({
  tracking_number: z.string().min(8),
  private_code: z.string().min(8),
});

export async function submitComplaint(formData: FormData) {
  const parsed = complaintSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/denuncias/nueva?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const admin = createAdminClient();
  if (!admin) redirect("/denuncias/nueva?error=Supabase%20no%20est%C3%A1%20configurado");
  const privateCode = `DEN-${randomBytes(9).toString("base64url").toUpperCase()}`;
  const privateCodeHash = createHash("sha256").update(privateCode).digest("hex");
  const anonymous = parsed.data.anonymous === "on";
  const { data, error } = await admin.from("complaints").insert({
    anonymous,
    complainant_name: anonymous ? null : parsed.data.complainant_name || null,
    contact_method: parsed.data.contact_method || null,
    category: parsed.data.category,
    reported_subject: parsed.data.reported_subject || null,
    description: parsed.data.description,
    occurred_on: parsed.data.occurred_on || null,
    location: parsed.data.location || null,
    private_code_hash: privateCodeHash,
  }).select("id,tracking_number").single();
  if (error || !data) redirect(`/denuncias/nueva?error=${encodeURIComponent("No fue posible registrar la denuncia")}`);

  const evidence = formData.get("evidence");
  if (evidence instanceof File && evidence.size > 0) {
    if (evidence.size > 10 * 1024 * 1024) redirect(`/denuncias/nueva?error=${encodeURIComponent("El adjunto supera 10 MB")}`);
    const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);
    if (!allowed.has(evidence.type)) redirect(`/denuncias/nueva?error=${encodeURIComponent("Tipo de archivo no permitido")}`);
    const safeName = evidence.name.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-120);
    const path = `${data.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await admin.storage.from("complaint-files").upload(path, evidence, { contentType: evidence.type, upsert: false });
    if (!uploadError) {
      await admin.from("complaint_attachments").insert({
        complaint_id: data.id,
        file_path: path,
        original_name: evidence.name,
        content_type: evidence.type,
        size_bytes: evidence.size,
      });
    }
  }

  redirect(`/denuncias/confirmacion?tracking=${encodeURIComponent(data.tracking_number)}&code=${encodeURIComponent(privateCode)}`);
}

export async function lookupComplaintStatus(formData: FormData) {
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/denuncias/estado?error=${encodeURIComponent("No se encontró una denuncia con los datos ingresados.")}`);
  const supabase = await createClient();
  if (!supabase) redirect("/denuncias/estado?error=Supabase%20no%20est%C3%A1%20configurado");
  const { data, error } = await supabase.rpc("lookup_complaint_status", parsed.data);
  if (error || !data || data.length === 0) redirect(`/denuncias/estado?error=${encodeURIComponent("No se encontró una denuncia con los datos ingresados.")}`);
  const result = data[0] as { tracking_number: string };
  redirect(`/denuncias/estado?tracking=${encodeURIComponent(result.tracking_number)}&code=${encodeURIComponent(parsed.data.private_code)}`);
}

export async function updateComplaint(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  const priority = String(formData.get("priority") || "Normal");
  const public_response = String(formData.get("public_response") || "");
  const internal_notes = String(formData.get("internal_notes") || "");
  const supabase = await createClient();
  if (!supabase) redirect("/admin/denuncias?error=Supabase%20no%20configurado");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("complaints").update({ status, priority, public_response, internal_notes, public_updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/admin/denuncias?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/denuncias?updated=1");
}

export async function archiveComplaint(formData: FormData) {
  const id = String(formData.get("id") || "");
  const operation = String(formData.get("operation") || "archive");
  const supabase = await createClient();
  if (!supabase) redirect("/admin/denuncias?error=Supabase%20no%20configurado");
  const update: Record<string, string | null> = operation === "restore" ? { archived_at: null, archived_by: null, status: "Recibida" } : { archived_at: new Date().toISOString(), status: "Archivada" };
  const { error } = await supabase.from("complaints").update(update).eq("id", id);
  if (error) redirect(`/admin/denuncias?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/denuncias?updated=1");
}
