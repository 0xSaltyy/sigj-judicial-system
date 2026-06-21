"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enforcePermission, PERMISSIONS, requireCaseAccess } from "@/lib/auth/permissions";
import { dbUuid } from "@/lib/validation";

const style = z.enum(["corte_suprema", "tribunal_superior"]);
const voteTypes = z.enum(["Salvamento de voto", "Aclaración de voto", "Aclaración parcial", "Salvamento parcial", "Voto concurrente"]);
const salaStatus = z.enum(["En estudio", "En sala", "Aprobado en sala", "Con salvamento/aclaración", "Devuelto a ponente", "Publicado", "Archivado"]);

function destination(id: string, segment: string, kind: "error" | "success", message: string): never {
  redirect(`/admin/providencias/${id}/${segment}?${kind}=${encodeURIComponent(message)}`);
}

export async function saveSalaSession(formData: FormData) {
  const parsed = z.object({
    session_id: dbUuid.optional().or(z.literal("")), case_id: dbUuid, proceeding_id: dbUuid,
    institution_style: style, chamber: z.string().trim().min(2).max(180), session_type: z.string().trim().min(2).max(120),
    act_number: z.string().trim().max(80).optional(), session_date: z.string().optional(), rapporteur_id: dbUuid.optional().or(z.literal("")),
    vote_result: z.string().trim().max(200).optional(), quorum: z.coerce.number().int().min(0).max(100).optional(),
    status: salaStatus, observations: z.string().trim().max(3000).optional(),
  }).safeParse(Object.fromEntries(formData));
  const proceedingId = String(formData.get("proceeding_id") || "");
  if (!parsed.success) destination(proceedingId, "sala", "error", parsed.error.issues[0].message);
  const session = await requireCaseAccess(parsed.data.case_id, PERMISSIONS.salaView);
  const { supabase, user } = session;
  const actionPermission = parsed.data.status === "En sala" ? PERMISSIONS.salaSend
    : parsed.data.status === "Aprobado en sala" ? PERMISSIONS.salaApprove
      : parsed.data.status === "Devuelto a ponente" ? PERMISSIONS.salaReturn
        : parsed.data.status === "Publicado" ? PERMISSIONS.salaPublish : PERMISSIONS.salaRegisterSession;
  await enforcePermission(session, actionPermission, parsed.data.proceeding_id);
  const { data: proceeding } = await supabase.from("proceedings").select("id,status,archived_at").eq("id", parsed.data.proceeding_id).eq("case_id", parsed.data.case_id).maybeSingle();
  if (!proceeding || proceeding.archived_at) destination(proceedingId, "sala", "error", "La providencia no está disponible");
  const payload = {
    case_id: parsed.data.case_id, proceeding_id: parsed.data.proceeding_id, institution_style: parsed.data.institution_style,
    chamber: parsed.data.chamber, session_type: parsed.data.session_type, act_number: parsed.data.act_number || null,
    session_date: parsed.data.session_date || null, rapporteur_id: parsed.data.rapporteur_id || null,
    vote_result: parsed.data.vote_result || null, quorum: parsed.data.quorum ?? null, status: parsed.data.status,
    observations: parsed.data.observations || null,
  };
  const result = parsed.data.session_id
    ? await supabase.from("sala_sessions").update(payload).eq("id", parsed.data.session_id).eq("proceeding_id", parsed.data.proceeding_id).select("id").maybeSingle()
    : await supabase.from("sala_sessions").insert({ ...payload, created_by: user.id }).select("id").maybeSingle();
  if (result.error || !result.data) destination(proceedingId, "sala", "error", result.error?.message ?? "No fue posible guardar la sesión");
  const participantIds = formData.getAll("participant_ids").map(String).filter((value) => dbUuid.safeParse(value).success);
  if (participantIds.length) {
    await supabase.from("sala_participants").delete().eq("sala_session_id", result.data.id);
    const participantResult = await supabase.from("sala_participants").insert(participantIds.map((profileId) => ({ sala_session_id: result.data!.id, profile_id: profileId })));
    if (participantResult.error) destination(proceedingId, "sala", "error", participantResult.error.message);
  }
  await supabase.rpc("log_security_event", { p_action: `SALA_${parsed.data.status.toUpperCase().replaceAll(" ", "_")}`, p_table: "sala_sessions", p_record_id: result.data.id, p_description: `Flujo de Sala actualizado: ${parsed.data.status}`, p_metadata: { proceeding_id: parsed.data.proceeding_id, act_number: parsed.data.act_number || null } });
  if (parsed.data.rapporteur_id && parsed.data.rapporteur_id !== user.id) await supabase.rpc("create_internal_notification", { p_recipient: parsed.data.rapporteur_id, p_title: "Actualización de decisión en Sala", p_message: "Una providencia asignada fue actualizada en Modo Sala.", p_type: parsed.data.status === "Aprobado en sala" ? "decision_aprobada_sala" : "sala_convocada", p_link_url: `/admin/providencias/${parsed.data.proceeding_id}/sala`, p_priority: "high", p_record_type: "sala_session", p_record_id: result.data.id });
  revalidatePath(`/admin/providencias/${parsed.data.proceeding_id}`);
  destination(proceedingId, "sala", "success", "Información de Sala guardada y auditada");
}

export async function saveVoteDocument(formData: FormData) {
  const parsed = z.object({
    vote_id: dbUuid.optional().or(z.literal("")), case_id: dbUuid, proceeding_id: dbUuid, institution_style: style,
    vote_type: voteTypes, title: z.string().trim().min(3).max(200), content_markdown: z.string().trim().min(20).max(100000),
    status: z.enum(["Borrador", "Presentado", "Firmado", "Publicado"]), visibility: z.enum(["public", "internal", "reserved"]),
  }).safeParse(Object.fromEntries(formData));
  const proceedingId = String(formData.get("proceeding_id") || "");
  if (!parsed.success) destination(proceedingId, "votos/nuevo", "error", parsed.error.issues[0].message);
  const session = await requireCaseAccess(parsed.data.case_id, parsed.data.vote_id ? PERMISSIONS.votesEdit : PERMISSIONS.votesCreate);
  const { supabase, user, profile } = session;
  const { data: parent } = await supabase.from("proceedings").select("id,status,archived_at,case:cases(confidentiality_level,public_visibility)").eq("id", parsed.data.proceeding_id).eq("case_id", parsed.data.case_id).maybeSingle();
  if (!parent || parent.archived_at) destination(proceedingId, "votos/nuevo", "error", "La providencia principal no está disponible");
  const parentCase = Array.isArray(parent.case) ? parent.case[0] : parent.case;
  if (parsed.data.visibility === "public" && (parentCase?.confidentiality_level !== "Público" || !parentCase.public_visibility)) destination(proceedingId, "votos/nuevo", "error", "Un expediente reservado no puede tener votos públicos");
  if (parsed.data.status === "Publicado") await enforcePermission(session, PERMISSIONS.votesPublish, parsed.data.vote_id || parsed.data.proceeding_id);
  const existing = parsed.data.vote_id ? await supabase.from("vote_documents").select("id,author_id,status").eq("id", parsed.data.vote_id).eq("proceeding_id", parsed.data.proceeding_id).maybeSingle() : { data: null };
  if (existing.data && existing.data.author_id !== user.id && !profile.is_owner) destination(proceedingId, "votos/nuevo", "error", "Sólo el autor puede editar este voto");
  if (existing.data && ["Firmado", "Publicado"].includes(existing.data.status)) destination(proceedingId, "votos/nuevo", "error", "Un voto firmado o publicado no puede editarse sin reapertura auditada");
  const payload = { case_id: parsed.data.case_id, proceeding_id: parsed.data.proceeding_id, author_id: user.id, institution_style: parsed.data.institution_style, vote_type: parsed.data.vote_type, title: parsed.data.title, content_markdown: parsed.data.content_markdown, status: parsed.data.status, visibility: parsed.data.visibility, ...(parsed.data.status === "Publicado" ? { published_at: new Date().toISOString() } : {}) };
  const result = parsed.data.vote_id
    ? await supabase.from("vote_documents").update(payload).eq("id", parsed.data.vote_id).eq("author_id", user.id).select("id").maybeSingle()
    : await supabase.from("vote_documents").insert({ ...payload, created_by: user.id }).select("id").maybeSingle();
  if (result.error || !result.data) destination(proceedingId, "votos/nuevo", "error", result.error?.message ?? "No fue posible guardar el voto");
  await supabase.rpc("log_security_event", { p_action: `VOTE_DOCUMENT_${parsed.data.status === "Borrador" ? "SAVED" : parsed.data.status.toUpperCase()}`, p_table: "vote_documents", p_record_id: result.data.id, p_description: `${parsed.data.vote_type} guardado como ${parsed.data.status}`, p_metadata: { proceeding_id: parsed.data.proceeding_id, institution_style: parsed.data.institution_style } });
  if (parsed.data.status === "Presentado") {
    const { data: sala } = await supabase.from("sala_sessions").select("id,rapporteur_id").eq("proceeding_id", parsed.data.proceeding_id).maybeSingle();
    if (sala?.rapporteur_id && sala.rapporteur_id !== user.id) await supabase.rpc("create_internal_notification", { p_recipient: sala.rapporteur_id, p_title: parsed.data.vote_type, p_message: "Se presentó un voto particular asociado a la decisión.", p_type: parsed.data.vote_type.startsWith("Salvamento") ? "salvamento_presentado" : "aclaracion_presentada", p_link_url: `/admin/providencias/${parsed.data.proceeding_id}`, p_priority: "high", p_record_type: "vote_document", p_record_id: result.data.id });
  }
  revalidatePath(`/admin/providencias/${parsed.data.proceeding_id}`);
  redirect(`/admin/providencias/${parsed.data.proceeding_id}?success=${encodeURIComponent(`${parsed.data.vote_type} guardado`)}`);
}
