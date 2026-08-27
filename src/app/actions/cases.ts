"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const caseSchema = z.object({
  authority_type: z.string().min(1), chamber: z.string().min(1), process_type: z.string().min(1), process_subtype: z.string().min(1),
  claimant_name: z.string().min(3, "La parte solicitante es obligatoria"), defendant_name: z.string().min(3, "La parte convocada es obligatoria"),
  summary: z.string().min(20, "El resumen debe tener al menos 20 caracteres"), claims: z.string().min(10), department: z.string().min(1), municipality: z.string().min(1),
  reception_method: z.string().min(1), confidentiality_level: z.enum(["Público", "Reservado", "Confidencial"]), filed_at: z.string().min(1), amount: z.string().optional(), observations: z.string().optional(),
});
const chamberCodes: Record<string, string> = { "Sala Penal": "SP", "Sala Civil": "SC", "Sala Laboral": "SL", "Sala Administrativa": "SA" };

export async function createCase(formData: FormData) {
  const parsed = caseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/expedientes/nuevo?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase = await createClient();
  if (!supabase) redirect(`/admin/expedientes/nuevo?error=${encodeURIComponent("Supabase no está configurado")}`);
  const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const chamberCode = chamberCodes[parsed.data.chamber] ?? "MC";
  const [{ data: caseNumber }, { data: judicialNumber }] = await Promise.all([
    supabase.rpc("generate_case_number_for_date", { p_process_type: parsed.data.process_type, p_opened_at: parsed.data.filed_at }),
    supabase.rpc("generate_judicial_case_number", { dependency_code: "001" }),
  ]);
  const stableCaseNumber = typeof caseNumber === "string" && caseNumber ? caseNumber : `RP-${chamberCode}-${new Date(parsed.data.filed_at).getUTCFullYear()}-${Date.now().toString().slice(-6)}`;
  const payload = { ...parsed.data, amount: parsed.data.amount ? Number(parsed.data.amount) : null, title: `${parsed.data.process_type} · ${parsed.data.process_subtype}`, case_number: stableCaseNumber, internal_number: stableCaseNumber, judicial_number: judicialNumber, docket_number: null, filing_status: "Sin presentación judicial", status: "Abierto", public_visibility: parsed.data.confidentiality_level === "Público", created_by: user.id };
  const { data: record, error } = await supabase.from("cases").insert(payload).select("id").single();
  if (error || !record) redirect(`/admin/expedientes/nuevo?error=${encodeURIComponent(error?.message ?? "No fue posible crear el caso")}`);
  await Promise.all([
    supabase.from("case_parties").insert([{ case_id: record.id, name: parsed.data.claimant_name, party_type: "Solicitante" }, { case_id: record.id, name: parsed.data.defendant_name, party_type: "Convocada" }]),
    supabase.from("case_actions").insert({ case_id: record.id, action_type: "Apertura de caso", title: "Apertura del caso", description: "Se registra el caso y se asigna un número de caso único.", visibility: parsed.data.confidentiality_level === "Público" ? "public" : "internal", created_by: user.id }),
  ]);
  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const path = `${record.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("case-documents").upload(path, file, { upsert: false });
    if (!uploadError) await supabase.from("documents").insert({ case_id: record.id, uploaded_by: user.id, title: file.name, file_path: path, file_type: file.type, visibility: "internal" });
  }
  redirect(`/admin/expedientes/${record.id}?created=1`);
}
