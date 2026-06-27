"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enforcePermission, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { dbUuid } from "@/lib/validation";
import { slugifyElection } from "@/lib/elections";

const electionSchema=z.object({election_id:dbUuid.optional(),title:z.string().trim().min(8).max(220),office:z.string().trim().min(3).max(180),territory:z.string().trim().min(2).max(160),period:z.string().trim().min(4).max(80),round_label:z.string().trim().min(3).max(80),institution_id:dbUuid.optional().or(z.literal("")),status:z.enum(["draft","prepared","open","suspended","reopened","closed","scrutiny","preliminary_results","definitively_closed","final_results_published","archived"]),opens_at:z.string().min(1),closes_at:z.string().min(1),description:z.string().trim().min(20).max(12000),instructions:z.string().trim().max(5000).optional(),ballot_image_path:z.string().trim().max(400).optional()});
export async function saveElection(formData:FormData){
  const parsed=electionSchema.safeParse(Object.fromEntries(formData));const fallback=String(formData.get("election_id")||"");
  if(!parsed.success)redirect(`${fallback?`/admin/elecciones/${fallback}`:"/admin/elecciones/nueva"}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const session=await requirePermission(parsed.data.election_id?PERMISSIONS.electionsEdit:PERMISSIONS.electionsCreate);
  const opening=new Date(parsed.data.opens_at),closing=new Date(parsed.data.closes_at);if(!(closing>opening))redirect(`${parsed.data.election_id?`/admin/elecciones/${parsed.data.election_id}`:"/admin/elecciones/nueva"}?error=El%20cierre%20debe%20ser%20posterior%20a%20la%20apertura`);
  const statusPermission:Record<string,typeof PERMISSIONS.electionsOpen|typeof PERMISSIONS.electionsSuspend|typeof PERMISSIONS.electionsReopen|typeof PERMISSIONS.electionsClose|typeof PERMISSIONS.electionsDefinitiveClose|typeof PERMISSIONS.electionsPublishPreliminary|typeof PERMISSIONS.electionsPublishResults|undefined>={
    open:PERMISSIONS.electionsOpen,suspended:PERMISSIONS.electionsSuspend,reopened:PERMISSIONS.electionsReopen,closed:PERMISSIONS.electionsClose,definitively_closed:PERMISSIONS.electionsDefinitiveClose,preliminary_results:PERMISSIONS.electionsPublishPreliminary,final_results_published:PERMISSIONS.electionsPublishResults,
  };
  const needed=statusPermission[parsed.data.status]; if(needed)await enforcePermission(session,needed,parsed.data.election_id??null);
  const payload={title:parsed.data.title,office:parsed.data.office,territory:parsed.data.territory,period:parsed.data.period,round_label:parsed.data.round_label,institution_id:parsed.data.institution_id||null,status:parsed.data.status,opens_at:opening.toISOString(),closes_at:closing.toISOString(),description:parsed.data.description,instructions:parsed.data.instructions||null,ballot_image_path:parsed.data.ballot_image_path||"/VOTACIONES/CARTA DE VOTACION.png",updated_by:session.user.id};
  if(parsed.data.election_id){const {error}=await session.supabase.from("elections").update(payload).eq("id",parsed.data.election_id);if(error)redirect(`/admin/elecciones/${parsed.data.election_id}?error=${encodeURIComponent(error.message)}`);revalidatePath("/admin/elecciones");redirect(`/admin/elecciones/${parsed.data.election_id}?success=Elecci%C3%B3n%20actualizada`);}
  const slug=`${slugifyElection(parsed.data.title)}-${crypto.randomUUID().slice(0,6)}`;
  const {data,error}=await session.supabase.from("elections").insert({...payload,slug,created_by:session.user.id}).select("id").single();
  if(error||!data)redirect(`/admin/elecciones/nueva?error=${encodeURIComponent(error?.message??"No fue posible crear la elección")}`);
  await session.supabase.rpc("log_security_event",{p_action:"ELECTION_CREATED",p_table:"elections",p_record_id:data.id,p_description:"Elección institucional creada",p_metadata:{status:parsed.data.status}});
  revalidatePath("/admin/elecciones");redirect(`/admin/elecciones/${data.id}?success=Elecci%C3%B3n%20creada`);
}

const optionSchema=z.object({option_id:dbUuid.optional(),election_id:dbUuid,option_number:z.coerce.number().int().min(1).max(99),candidate_name:z.string().trim().min(2).max(180),office_label:z.string().trim().max(180).optional(),party_name:z.string().trim().max(180).optional(),candidate_image_path:z.string().trim().max(400).optional(),ballot_card_image_path:z.string().trim().max(400).optional(),is_blank_vote:z.string().optional(),active:z.string().optional(),display_order:z.coerce.number().int().min(1).max(99)});
export async function saveElectionOption(formData:FormData){
  const parsed=optionSchema.safeParse(Object.fromEntries(formData));if(!parsed.success)redirect("/admin/elecciones?error=Opción%20electoral%20inválida");
  const session=await requirePermission(PERMISSIONS.electionsConfigureBallot);
  const payload={election_id:parsed.data.election_id,option_number:parsed.data.option_number,candidate_name:parsed.data.candidate_name,office_label:parsed.data.office_label||null,party_name:parsed.data.party_name||null,candidate_image_path:parsed.data.candidate_image_path||null,ballot_card_image_path:parsed.data.ballot_card_image_path||null,is_blank_vote:parsed.data.is_blank_vote==="true",active:parsed.data.active!=="false",display_order:parsed.data.display_order};
  const result=parsed.data.option_id?await session.supabase.from("election_options").update(payload).eq("id",parsed.data.option_id).eq("election_id",parsed.data.election_id):await session.supabase.from("election_options").insert(payload);
  if(result.error)redirect(`/admin/elecciones/${parsed.data.election_id}/tarjeta?error=${encodeURIComponent(result.error.message)}`);
  await session.supabase.rpc("log_security_event",{p_action:"ELECTION_BALLOT_CONFIGURED",p_table:"election_options",p_record_id:parsed.data.option_id||parsed.data.election_id,p_description:"Opción o tarjeta electoral configurada",p_metadata:{election_id:parsed.data.election_id}});
  revalidatePath(`/admin/elecciones/${parsed.data.election_id}`);redirect(`/admin/elecciones/${parsed.data.election_id}/tarjeta?success=Tarjeta%20actualizada`);
}

export async function submitOnlineVote(formData:FormData){
  const parsed=z.object({election_id:dbUuid,option_id:dbUuid,slug:z.string().min(2),discord_username:z.string().trim().min(2).max(120),discord_id:z.string().trim().max(120).optional(),visible_name:z.string().trim().max(160).optional(),roblox_username:z.string().trim().max(120).optional(),contact_note:z.string().trim().max(500).optional()}).safeParse(Object.fromEntries(formData));
  const slug=String(formData.get("slug")||"");if(!parsed.success)redirect(`/elecciones/${encodeURIComponent(slug)}/votar?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase=await createClient();if(!supabase)redirect(`/elecciones/${parsed.data.slug}/votar?error=Servicio%20no%20disponible`);
  const {data,error}=await supabase.rpc("submit_online_vote",{p_election_id:parsed.data.election_id,p_option_id:parsed.data.option_id,p_discord_username:parsed.data.discord_username,p_discord_id:parsed.data.discord_id||"",p_visible_name:parsed.data.visible_name||"",p_roblox_username:parsed.data.roblox_username||"",p_contact_note:parsed.data.contact_note||""});
  if(error||!data?.receipt_code)redirect(`/elecciones/${parsed.data.slug}/votar?error=${encodeURIComponent(error?.message??"No fue posible registrar el voto")}`);
  redirect(`/elecciones/comprobante?receipt=${encodeURIComponent(String(data.receipt_code))}&state=${encodeURIComponent(String(data.status))}`);
}

export type ReceiptLookupState={error?:string;result?:{electionTitle:string;receiptCode:string;submittedAt:string;status:string;message:string}};
export async function lookupElectionReceipt(_:ReceiptLookupState,formData:FormData):Promise<ReceiptLookupState>{
  const parsed=z.object({receipt_code:z.string().trim().min(8).max(40),discord:z.string().trim().min(2).max(120)}).safeParse(Object.fromEntries(formData));if(!parsed.success)return {error:"No se encontró un comprobante con los datos ingresados."};
  const supabase=await createClient();if(!supabase)return {error:"No fue posible consultar el comprobante."};
  const {data,error}=await supabase.rpc("lookup_election_receipt",{p_receipt_code:parsed.data.receipt_code,p_discord:parsed.data.discord});const row=data?.[0];
  if(error||!row)return {error:"No se encontró un comprobante con los datos ingresados."};
  return {result:{electionTitle:row.election_title,receiptCode:row.receipt_code,submittedAt:row.submitted_at,status:row.status,message:row.public_message}};
}

export async function addManualVoteBatch(formData:FormData){
  const parsed=z.object({election_id:dbUuid,option_id:dbUuid,quantity:z.coerce.number().int().min(1).max(100000),source_label:z.string().trim().min(2).max(180),polling_station:z.string().trim().max(120).optional(),witness_name:z.string().trim().max(180).optional(),notes:z.string().trim().max(2000).optional()}).safeParse(Object.fromEntries(formData));if(!parsed.success)redirect("/admin/elecciones?error=Lote%20manual%20inválido");
  const session=await requirePermission(PERMISSIONS.electionsAddManualVotes);
  const {error}=await session.supabase.rpc("add_manual_vote_batch",{p_election_id:parsed.data.election_id,p_option_id:parsed.data.option_id,p_quantity:parsed.data.quantity,p_source_label:parsed.data.source_label,p_polling_station:parsed.data.polling_station||"",p_witness_name:parsed.data.witness_name||"",p_notes:parsed.data.notes||""});
  if(error)redirect(`/admin/elecciones/${parsed.data.election_id}/votos-manuales?error=${encodeURIComponent(error.message)}`);revalidatePath(`/admin/elecciones/${parsed.data.election_id}`);redirect(`/admin/elecciones/${parsed.data.election_id}/votos-manuales?success=Lote%20manual%20registrado`);
}

export async function reviewElectionVote(formData:FormData){
  const parsed=z.object({election_id:dbUuid,vote_id:dbUuid,status:z.enum(["pending_validation","valid","observed","annulled","rejected","duplicate","cancelled"]),note:z.string().trim().max(1000).optional()}).safeParse(Object.fromEntries(formData));if(!parsed.success)redirect("/admin/elecciones?error=Revisión%20inválida");
  const session=await requirePermission(["annulled","rejected","duplicate","cancelled"].includes(parsed.data.status)?PERMISSIONS.electionsAnnulVotes:PERMISSIONS.electionsValidateVotes);
  const {error}=await session.supabase.rpc("review_election_vote",{p_vote_id:parsed.data.vote_id,p_status:parsed.data.status,p_note:parsed.data.note||""});
  if(error)redirect(`/admin/elecciones/${parsed.data.election_id}/escrutinio?error=${encodeURIComponent(error.message)}`);revalidatePath(`/admin/elecciones/${parsed.data.election_id}`);redirect(`/admin/elecciones/${parsed.data.election_id}/escrutinio?success=Voto%20revisado`);
}

export async function reviewManualVoteBatch(formData:FormData){
  const parsed=z.object({election_id:dbUuid,batch_id:dbUuid,status:z.enum(["validated","rejected","annulled","pending_validation"]),note:z.string().trim().max(1000).optional()}).safeParse(Object.fromEntries(formData));if(!parsed.success)redirect("/admin/elecciones?error=Validación%20manual%20inválida");
  const session=await requirePermission(PERMISSIONS.electionsValidateManualVotes);
  const {error}=await session.supabase.rpc("review_manual_vote_batch",{p_batch_id:parsed.data.batch_id,p_status:parsed.data.status,p_note:parsed.data.note||""});
  if(error)redirect(`/admin/elecciones/${parsed.data.election_id}/votos-manuales?error=${encodeURIComponent(error.message)}`);revalidatePath(`/admin/elecciones/${parsed.data.election_id}`);redirect(`/admin/elecciones/${parsed.data.election_id}/votos-manuales?success=Lote%20manual%20revisado`);
}

export async function publishElectionResults(formData:FormData){
  const parsed=z.object({election_id:dbUuid,kind:z.enum(["preliminary","final","winner"]),winner_option_id:dbUuid.optional().or(z.literal("")),note:z.string().trim().max(1000).optional()}).safeParse(Object.fromEntries(formData));if(!parsed.success)redirect("/admin/elecciones?error=Publicación%20inválida");
  const permission=parsed.data.kind==="preliminary"?PERMISSIONS.electionsPublishPreliminary:parsed.data.kind==="final"?PERMISSIONS.electionsPublishResults:PERMISSIONS.electionsDeclareWinner;
  const session=await requirePermission(permission);
  const {error}=await session.supabase.rpc("publish_election_results",{p_election_id:parsed.data.election_id,p_kind:parsed.data.kind,p_winner_option_id:parsed.data.winner_option_id||null,p_note:parsed.data.note||""});
  if(error)redirect(`/admin/elecciones/${parsed.data.election_id}/resultados?error=${encodeURIComponent(error.message)}`);revalidatePath(`/admin/elecciones/${parsed.data.election_id}`);redirect(`/admin/elecciones/${parsed.data.election_id}/resultados?success=Resultados%20actualizados`);
}
