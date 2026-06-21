"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enforcePermission, PERMISSIONS, requireCaseAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbUuid } from "@/lib/validation";

const style = z.enum(["corte_suprema", "tribunal_superior"]);
const voteTypes = z.enum(["Salvamento de voto", "Aclaración de voto", "Aclaración parcial", "Salvamento parcial", "Voto concurrente"]);
const sessionIntent = z.enum(["save_session", "send_to_sala", "approve", "return", "publish"]);
const voteValue = z.enum(["aprueba", "no_aprueba", "abstencion", "ausente", "impedido"]);
const opinionType = z.enum(["", "salvamento", "aclaracion", "salvamento_parcial", "aclaracion_parcial", "concurrente"]);

function destination(id: string, segment: string, kind: "error" | "success", message: string): never {
  redirect(`/admin/providencias/${id}/${segment}?${kind}=${encodeURIComponent(message)}`);
}

async function notifyUsers(
  supabase: Awaited<ReturnType<typeof requireCaseAccess>>["supabase"],
  recipients: string[],
  actorId: string,
  values: { title: string; message: string; type: string; link: string; recordType: string; recordId: string },
) {
  for (const recipient of new Set(recipients.filter((id) => id && id !== actorId))) {
    await supabase.rpc("create_internal_notification", {
      p_recipient: recipient, p_title: values.title, p_message: values.message, p_type: values.type,
      p_link_url: values.link, p_priority: "high", p_record_type: values.recordType, p_record_id: values.recordId,
    });
  }
}

export async function saveSalaSession(formData: FormData) {
  const parsed = z.object({
    session_id: dbUuid.optional().or(z.literal("")), case_id: dbUuid, proceeding_id: dbUuid,
    institution_style: style, chamber: z.string().trim().min(2).max(180), session_type: z.string().trim().min(2).max(120),
    act_number: z.string().trim().max(80).optional(), session_date: z.string().optional(), rapporteur_id: dbUuid.optional().or(z.literal("")),
    quorum: z.coerce.number().int().min(0).max(100).optional(), observations: z.string().trim().max(3000).optional(), intent: sessionIntent,
  }).safeParse(Object.fromEntries(formData));
  const proceedingId = String(formData.get("proceeding_id") || "");
  if (!parsed.success) destination(proceedingId, "sala", "error", parsed.error.issues[0].message);
  const session = await requireCaseAccess(parsed.data.case_id, PERMISSIONS.salaView);
  const { supabase, user } = session;
  const actionPermission = parsed.data.intent === "send_to_sala" ? PERMISSIONS.salaSend
    : parsed.data.intent === "approve" ? PERMISSIONS.salaApprove
      : parsed.data.intent === "return" ? PERMISSIONS.salaReturn
        : parsed.data.intent === "publish" ? PERMISSIONS.salaPublish : PERMISSIONS.salaRegisterSession;
  await enforcePermission(session, actionPermission, parsed.data.proceeding_id);
  const { data: proceeding } = await supabase.from("proceedings").select("id,status,archived_at").eq("id", parsed.data.proceeding_id).eq("case_id", parsed.data.case_id).maybeSingle();
  if (!proceeding || proceeding.archived_at) destination(proceedingId, "sala", "error", "La providencia no está disponible");
  const requestedStatus = parsed.data.intent === "send_to_sala" ? "En sala" : parsed.data.intent === "approve" ? "Aprobado en sala" : parsed.data.intent === "return" ? "Devuelto a ponente" : parsed.data.intent === "publish" ? "Publicado" : "En estudio";
  if (parsed.data.intent === "approve" && parsed.data.session_id) {
    const { count } = await supabase.from("sala_votes").select("id", { count: "exact", head: true }).eq("sala_session_id", parsed.data.session_id);
    if (!count) destination(proceedingId, "sala", "error", "Registre la votación nominal antes de aprobar la decisión en Sala");
  }
  const payload = {
    case_id: parsed.data.case_id, proceeding_id: parsed.data.proceeding_id, institution_style: parsed.data.institution_style,
    chamber: parsed.data.chamber, session_type: parsed.data.session_type, act_number: parsed.data.act_number || null,
    session_date: parsed.data.session_date || null, rapporteur_id: parsed.data.rapporteur_id || null,
    quorum: parsed.data.quorum ?? null, status: requestedStatus, observations: parsed.data.observations || null,
  };
  const result = parsed.data.session_id
    ? await supabase.from("sala_sessions").update(payload).eq("id", parsed.data.session_id).eq("proceeding_id", parsed.data.proceeding_id).select("id").maybeSingle()
    : await supabase.from("sala_sessions").insert({ ...payload, created_by: user.id }).select("id").maybeSingle();
  if (result.error || !result.data) destination(proceedingId, "sala", "error", result.error?.message ?? "No fue posible guardar la sesión");
  const participantIds = formData.getAll("participant_ids").map(String).filter((value) => dbUuid.safeParse(value).success);
  const deleteResult = await supabase.from("sala_participants").delete().eq("sala_session_id", result.data.id);
  if (deleteResult.error) destination(proceedingId, "sala", "error", deleteResult.error.message);
  if (participantIds.length) {
    const participantResult = await supabase.from("sala_participants").insert(participantIds.map((profileId) => ({ sala_session_id: result.data!.id, profile_id: profileId })));
    if (participantResult.error) destination(proceedingId, "sala", "error", participantResult.error.message);
  }
  const action = parsed.data.session_id ? `SALA_${parsed.data.intent.toUpperCase()}` : "SALA_SESSION_CREATED";
  await supabase.rpc("log_security_event", { p_action: action, p_table: "sala_sessions", p_record_id: result.data.id, p_description: parsed.data.session_id ? `Flujo de Sala actualizado: ${requestedStatus}` : "Sesión de Sala creada", p_metadata: { proceeding_id: parsed.data.proceeding_id, act_number: parsed.data.act_number || null, participants: participantIds.length } });
  const notification = parsed.data.intent === "approve"
    ? { title: "Decisión aprobada en Sala", message: "La providencia fue aprobada en la sesión colegiada.", type: "decision_aprobada_sala" }
    : parsed.data.intent === "send_to_sala"
      ? { title: "Votación de Sala solicitada", message: "La providencia fue enviada a Sala. Revise la sesión y registre su votación.", type: "votacion_sala_solicitada" }
      : { title: "Sesión de Sala actualizada", message: "Se actualizó la sesión colegiada de una providencia.", type: "sala_actualizada" };
  await notifyUsers(supabase, [...participantIds, parsed.data.rapporteur_id || ""], user.id, { ...notification, link: `/admin/providencias/${parsed.data.proceeding_id}/sala`, recordType: "sala_session", recordId: result.data.id });
  revalidatePath(`/admin/providencias/${parsed.data.proceeding_id}`);
  revalidatePath(`/admin/providencias/${parsed.data.proceeding_id}/sala`);
  destination(proceedingId, "sala", "success", parsed.data.session_id ? "Sesión de Sala actualizada y auditada" : "Sesión de Sala creada");
}

export async function saveSalaVoting(formData: FormData) {
  const parsed = z.object({ session_id: dbUuid, case_id: dbUuid, proceeding_id: dbUuid }).safeParse(Object.fromEntries(formData));
  const proceedingId = String(formData.get("proceeding_id") || "");
  if (!parsed.success) destination(proceedingId, "sala", "error", "La sesión de Sala no es válida");
  const session = await requireCaseAccess(parsed.data.case_id, PERMISSIONS.salaRegisterVote);
  await enforcePermission(session, PERMISSIONS.salaRegisterVote, parsed.data.proceeding_id);
  const voterIds = formData.getAll("voter_ids").map(String).filter((id) => dbUuid.safeParse(id).success);
  if (!voterIds.length) destination(proceedingId, "sala", "error", "Agregue magistrados participantes antes de registrar la votación");
  const entries = voterIds.map((id) => {
    const value = voteValue.safeParse(formData.get(`vote_value_${id}`));
    const opinion = opinionType.safeParse(formData.get(`opinion_type_${id}`) ?? "");
    if (!value.success || !opinion.success) destination(proceedingId, "sala", "error", "Complete el voto de cada participante");
    if (opinion.data.startsWith("salvamento") && value.data !== "no_aprueba") destination(proceedingId, "sala", "error", "El salvamento debe corresponder a un voto que no aprueba la decisión");
    if (["aclaracion", "aclaracion_parcial", "concurrente"].includes(opinion.data) && value.data !== "aprueba") destination(proceedingId, "sala", "error", "La aclaración o voto concurrente debe corresponder a un voto aprobatorio");
    return { voter_user_id: id, vote_value: value.data, notes: String(formData.get(`notes_${id}`) || "").slice(0, 1000), announced_opinion_type: opinion.data || null };
  });
  const { data, error } = await session.supabase.rpc("replace_sala_votes", { p_session_id: parsed.data.session_id, p_entries: entries });
  if (error) destination(proceedingId, "sala", "error", error.message);
  revalidatePath(`/admin/providencias/${parsed.data.proceeding_id}`);
  revalidatePath(`/admin/providencias/${parsed.data.proceeding_id}/sala`);
  destination(proceedingId, "sala", "success", `Votación de Sala registrada para ${data ?? entries.length} participante(s)`);
}

export async function saveVoteDocument(formData: FormData) {
  const parsed = z.object({
    vote_id: dbUuid.optional().or(z.literal("")), case_id: dbUuid, proceeding_id: dbUuid, institution_style: style,
    author_user_id: dbUuid, vote_type: voteTypes, title: z.string().trim().min(3).max(200), content_markdown: z.string().trim().min(20).max(100000),
    status: z.enum(["Borrador", "Presentado"]), visibility: z.enum(["public", "internal", "reserved"]),
  }).safeParse(Object.fromEntries(formData));
  const proceedingId = String(formData.get("proceeding_id") || "");
  const errorSegment = parsed.success && parsed.data.vote_id ? `votos/${parsed.data.vote_id}/editar` : "votos/nuevo";
  if (!parsed.success) destination(proceedingId, errorSegment, "error", parsed.error.issues[0].message);
  const session = await requireCaseAccess(parsed.data.case_id, parsed.data.vote_id ? PERMISSIONS.votesEdit : PERMISSIONS.votesCreate);
  const { supabase, user, profile } = session;
  const [{ data: parent }, { data: eligible }] = await Promise.all([
    supabase.from("proceedings").select("id,status,archived_at,case:cases(confidentiality_level,public_visibility)").eq("id", parsed.data.proceeding_id).eq("case_id", parsed.data.case_id).maybeSingle(),
    supabase.rpc("list_sala_eligible_profiles", { p_case_id: parsed.data.case_id }),
  ]);
  if (!parent || parent.archived_at) destination(proceedingId, errorSegment, "error", "La providencia principal no está disponible");
  const author = (eligible ?? []).find((person: { id: string }) => person.id === parsed.data.author_user_id);
  if (!author && !profile.is_owner) destination(proceedingId, errorSegment, "error", "El autor debe pertenecer a la Sala o decisión");
  if (parsed.data.author_user_id !== user.id && !profile.is_owner) destination(proceedingId, errorSegment, "error", "Sólo puede crear su propio voto particular");
  const parentCase = Array.isArray(parent.case) ? parent.case[0] : parent.case;
  if (parsed.data.visibility === "public" && (parentCase?.confidentiality_level !== "Público" || !parentCase.public_visibility)) destination(proceedingId, errorSegment, "error", "Un expediente reservado no puede tener votos públicos");
  const existing = parsed.data.vote_id ? await supabase.from("vote_documents").select("id,author_id,status").eq("id", parsed.data.vote_id).eq("proceeding_id", parsed.data.proceeding_id).maybeSingle() : { data: null };
  if (existing.data && existing.data.author_id !== user.id && !profile.is_owner) destination(proceedingId, errorSegment, "error", "Sólo el autor puede editar este voto particular");
  if (existing.data && existing.data.status !== "Borrador") destination(proceedingId, errorSegment, "error", "Sólo puede editarse un borrador");
  const authorName = author?.full_name ?? profile.full_name;
  const authorCargo = author?.position_title ?? profile.position_title ?? "Magistrado/a";
  const payload = { case_id: parsed.data.case_id, proceeding_id: parsed.data.proceeding_id, author_id: parsed.data.author_user_id, author_display_name: authorName, author_cargo: authorCargo, institution_style: parsed.data.institution_style, vote_type: parsed.data.vote_type, title: parsed.data.title, content_markdown: parsed.data.content_markdown, status: parsed.data.status, visibility: parsed.data.visibility };
  const result = parsed.data.vote_id
    ? await supabase.from("vote_documents").update(payload).eq("id", parsed.data.vote_id).eq("author_id", parsed.data.author_user_id).eq("status", "Borrador").select("id").maybeSingle()
    : await supabase.from("vote_documents").insert({ ...payload, created_by: user.id }).select("id").maybeSingle();
  if (result.error || !result.data) destination(proceedingId, errorSegment, "error", result.error?.message ?? "No fue posible guardar el voto particular");
  const event = parsed.data.status === "Presentado" ? "VOTE_OPINION_PRESENTED" : parsed.data.vote_id ? "VOTE_OPINION_DRAFT_UPDATED" : "VOTE_OPINION_DRAFT_CREATED";
  await supabase.rpc("log_security_event", { p_action: event, p_table: "vote_documents", p_record_id: result.data.id, p_description: `${parsed.data.vote_type} guardado como ${parsed.data.status}`, p_metadata: { proceeding_id: parsed.data.proceeding_id, author_id: parsed.data.author_user_id } });
  if (parsed.data.status === "Presentado") {
    const { data: sala } = await supabase.from("sala_sessions").select("rapporteur_id").eq("proceeding_id", parsed.data.proceeding_id).maybeSingle();
    await notifyUsers(supabase, [sala?.rapporteur_id || "", parsed.data.author_user_id], user.id, { title: `${parsed.data.vote_type} presentado`, message: "Se presentó un documento de voto particular asociado a la decisión.", type: "voto_particular_presentado", link: `/admin/providencias/${parsed.data.proceeding_id}/votos/${result.data.id}`, recordType: "vote_document", recordId: result.data.id });
  }
  revalidatePath(`/admin/providencias/${parsed.data.proceeding_id}`);
  redirect(`/admin/providencias/${parsed.data.proceeding_id}/votos/${result.data.id}?success=${encodeURIComponent(`${parsed.data.vote_type} guardado`)}`);
}

export async function manageVoteDocument(formData: FormData) {
  const parsed = z.object({ vote_id: dbUuid, case_id: dbUuid, proceeding_id: dbUuid, operation: z.enum(["publish", "archive", "reopen"]), reason: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/providencias?error=Voto%20particular%20no%20válido");
  const requirement = parsed.data.operation === "publish" ? PERMISSIONS.votesPublish : parsed.data.operation === "archive" ? PERMISSIONS.votesArchive : PERMISSIONS.votesEdit;
  const session = await requireCaseAccess(parsed.data.case_id, requirement);
  const { supabase, user, profile } = session;
  if (parsed.data.operation === "reopen") {
    if (!profile.is_owner) destination(parsed.data.proceeding_id, `votos/${parsed.data.vote_id}`, "error", "Sólo el propietario puede reabrir un voto firmado o publicado");
    const { error } = await supabase.rpc("reopen_vote_document", { p_vote_id: parsed.data.vote_id, p_reason: parsed.data.reason || "Corrección autorizada" });
    if (error) destination(parsed.data.proceeding_id, `votos/${parsed.data.vote_id}`, "error", error.message);
    revalidatePath(`/admin/providencias/${parsed.data.proceeding_id}`);
    destination(parsed.data.proceeding_id, `votos/${parsed.data.vote_id}/editar`, "success", "Voto particular reabierto; la firma anterior fue revocada");
  }
  const admin = createAdminClient();
  if (!admin) destination(parsed.data.proceeding_id, `votos/${parsed.data.vote_id}`, "error", "Servicio administrativo no configurado");
  const { data: vote } = await admin.from("vote_documents").select("id,status,author_id,vote_type").eq("id", parsed.data.vote_id).eq("proceeding_id", parsed.data.proceeding_id).eq("case_id", parsed.data.case_id).maybeSingle();
  if (!vote) destination(parsed.data.proceeding_id, `votos/${parsed.data.vote_id}`, "error", "El voto particular no está disponible");
  if (parsed.data.operation === "publish" && vote.status !== "Firmado") destination(parsed.data.proceeding_id, `votos/${parsed.data.vote_id}`, "error", "El voto particular debe estar firmado antes de publicarse");
  const next = parsed.data.operation === "publish" ? { status: "Publicado", published_at: new Date().toISOString() } : { status: "Archivado", archived_at: new Date().toISOString(), archived_by: user.id };
  const { error } = await admin.from("vote_documents").update(next).eq("id", vote.id);
  if (error) destination(parsed.data.proceeding_id, `votos/${parsed.data.vote_id}`, "error", error.message);
  await admin.from("audit_logs").insert({ user_id: user.id, action: parsed.data.operation === "publish" ? "VOTE_OPINION_PUBLISHED" : "VOTE_OPINION_ARCHIVED", table_name: "vote_documents", record_id: vote.id, description: `${vote.vote_type} ${parsed.data.operation === "publish" ? "publicado" : "archivado"}`, metadata: { proceeding_id: parsed.data.proceeding_id } });
  await notifyUsers(supabase, [vote.author_id], user.id, { title: `${vote.vote_type} ${parsed.data.operation === "publish" ? "publicado" : "archivado"}`, message: "El estado del documento de voto particular fue actualizado.", type: parsed.data.operation === "publish" ? "voto_particular_publicado" : "voto_particular_archivado", link: `/admin/providencias/${parsed.data.proceeding_id}/votos/${vote.id}`, recordType: "vote_document", recordId: vote.id });
  revalidatePath(`/admin/providencias/${parsed.data.proceeding_id}`);
  destination(parsed.data.proceeding_id, `votos/${vote.id}`, "success", parsed.data.operation === "publish" ? "Voto particular publicado" : "Voto particular archivado");
}
