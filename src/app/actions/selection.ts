"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { can, enforcePermission, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { dbUuid } from "@/lib/validation";

const processSchema=z.object({
  process_id:dbUuid.optional(),institution_id:dbUuid,dependency_id:dbUuid,title:z.string().trim().min(5).max(180),position_title:z.string().trim().min(3).max(160),
  description:z.string().trim().min(20).max(12000),requirements:z.string().trim().min(10).max(12000),responsibilities:z.string().trim().max(12000).optional(),
  opening_at:z.string().min(1),closing_at:z.string().min(1),status:z.enum(["borrador","abierto","cerrado","en_revision","preseleccion","entrevistas","finalizado","cancelado"]),
  vacancies:z.coerce.number().int().min(1).max(100),visibility:z.enum(["interno","publico"]),application_instructions:z.string().trim().max(5000).optional(),responsible_user_id:dbUuid.optional().or(z.literal("")),
});

export async function saveSelectionProcess(formData:FormData){
  const parsed=processSchema.safeParse(Object.fromEntries(formData));
  const fallback=String(formData.get("process_id")||"");
  if(!parsed.success)redirect(`${fallback?`/admin/seleccion/${fallback}`:"/admin/seleccion/nuevo"}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const session=await requirePermission(parsed.data.process_id?PERMISSIONS.selectionEdit:PERMISSIONS.selectionCreate);
  const {supabase,user}=session;
  const {data:within}=await supabase.rpc("dependency_is_within",{p_child:parsed.data.dependency_id,p_parent:parsed.data.institution_id});
  if(!within)redirect(`${parsed.data.process_id?`/admin/seleccion/${parsed.data.process_id}`:"/admin/seleccion/nuevo"}?error=El%20despacho%20no%20pertenece%20a%20la%20instituci%C3%B3n`);
  if(parsed.data.status==="abierto")await enforcePermission(session,{resource:"seleccion",action:"publish"},parsed.data.process_id??null);
  if(["cerrado","finalizado"].includes(parsed.data.status))await enforcePermission(session,{resource:"seleccion",action:"close"},parsed.data.process_id??null);
  if(parsed.data.status==="cancelado")await enforcePermission(session,{resource:"seleccion",action:"cancel"},parsed.data.process_id??null);
  const opening=new Date(parsed.data.opening_at),closing=new Date(parsed.data.closing_at);if(!(closing>opening))redirect(`${parsed.data.process_id?`/admin/seleccion/${parsed.data.process_id}`:"/admin/seleccion/nuevo"}?error=La%20fecha%20de%20cierre%20debe%20ser%20posterior%20a%20la%20apertura`);
  const payload={institution_id:parsed.data.institution_id,dependency_id:parsed.data.dependency_id,title:parsed.data.title,position_title:parsed.data.position_title,description:parsed.data.description,requirements:parsed.data.requirements,responsibilities:parsed.data.responsibilities||null,opening_at:opening.toISOString(),closing_at:closing.toISOString(),status:parsed.data.status,vacancies:parsed.data.vacancies,visibility:parsed.data.visibility,application_instructions:parsed.data.application_instructions||null,responsible_user_id:parsed.data.responsible_user_id||null};
  if(parsed.data.process_id){const {error}=await supabase.from("selection_processes").update(payload).eq("id",parsed.data.process_id);if(error)redirect(`/admin/seleccion/${parsed.data.process_id}?error=${encodeURIComponent("No fue posible guardar el proceso dentro de su alcance")}`);revalidatePath("/admin/seleccion");redirect(`/admin/seleccion/${parsed.data.process_id}?success=Proceso%20actualizado`);}
  const slug=`${slugify(parsed.data.position_title)}-${crypto.randomUUID().slice(0,8)}`;
  const {data,error}=await supabase.from("selection_processes").insert({...payload,slug,created_by:user.id}).select("id").single();
  if(error||!data)redirect(`/admin/seleccion/nuevo?error=${encodeURIComponent("No fue posible crear el proceso en el despacho seleccionado")}`);
  revalidatePath("/admin/seleccion");redirect(`/admin/seleccion/${data.id}?success=Proceso%20de%20selecci%C3%B3n%20creado`);
}

const applicationSchema=z.object({application_id:dbUuid,process_id:dbUuid,status:z.enum(["recibida","en_revision","preseleccionada","rechazada","entrevista","aceptada","archivada"]),internal_notes:z.string().trim().max(8000).optional(),public_message:z.string().trim().max(1000).optional(),score:z.union([z.literal(""),z.coerce.number().min(0).max(100)]).optional()});
export async function updateSelectionApplication(formData:FormData){
  const parsed=applicationSchema.safeParse(Object.fromEntries(formData));if(!parsed.success)redirect("/admin/seleccion?error=Datos%20de%20evaluaci%C3%B3n%20inv%C3%A1lidos");
  const session=await requirePermission(PERMISSIONS.selectionEditApplications);const [canEvaluate,canUpdateStatus,canEditPublicMessage,{data:current}]=await Promise.all([can(session.profile,"evaluate_applications","seleccion",{supabase:session.supabase}),can(session.profile,"update_application_status","seleccion",{supabase:session.supabase}),can(session.profile,"edit_public_message","seleccion",{supabase:session.supabase}),session.supabase.from("selection_applications").select("id,status,public_message").eq("id",parsed.data.application_id).eq("process_id",parsed.data.process_id).maybeSingle()]);
  if(!current)redirect(`/admin/seleccion/${parsed.data.process_id}?error=Postulaci%C3%B3n%20no%20disponible`);
  if(current.status!==parsed.data.status&&!canUpdateStatus)await enforcePermission(session,PERMISSIONS.selectionUpdateApplicationStatus,parsed.data.application_id);
  if(formData.has("public_message")&&(current.public_message??"")!==(parsed.data.public_message??"")&&!canEditPublicMessage)await enforcePermission(session,PERMISSIONS.selectionEditPublicMessage,parsed.data.application_id);
  const payload:Record<string,unknown>={status:canUpdateStatus?parsed.data.status:current.status,public_message:canEditPublicMessage?parsed.data.public_message||null:current.public_message};if(canEvaluate){payload.internal_notes=parsed.data.internal_notes||null;payload.score=parsed.data.score===""||parsed.data.score===undefined?null:parsed.data.score;payload.reviewed_by=session.user.id;payload.reviewed_at=new Date().toISOString();}
  const {data,error}=await session.supabase.from("selection_applications").update(payload).eq("id",parsed.data.application_id).eq("process_id",parsed.data.process_id).select("id").maybeSingle();
  if(error||!data)redirect(`/admin/seleccion/${parsed.data.process_id}?error=No%20fue%20posible%20actualizar%20la%20postulaci%C3%B3n`);revalidatePath(`/admin/seleccion/${parsed.data.process_id}`);redirect(`/admin/seleccion/${parsed.data.process_id}?success=Postulaci%C3%B3n%20actualizada`);
}

const publicSchema=z.object({process_id:dbUuid,slug:z.string().min(3),applicant_name:z.string().trim().min(3).max(180),applicant_email:z.string().trim().email().max(320),applicant_identifier:z.string().trim().max(160).optional(),phone:z.string().trim().max(80).optional(),statement:z.string().trim().min(20).max(12000),experience:z.string().trim().max(12000).optional(),website:z.string().max(0).optional()});
export async function submitSelectionApplication(formData:FormData){
  const parsed=publicSchema.safeParse(Object.fromEntries(formData));const slug=String(formData.get("slug")||"");if(!parsed.success)redirect(`/convocatorias/${encodeURIComponent(slug)}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase=await createClient();if(!supabase)redirect(`/convocatorias/${parsed.data.slug}?error=Servicio%20no%20disponible`);
  const {data,error}=await supabase.rpc("submit_selection_application",{p_process_id:parsed.data.process_id,p_name:parsed.data.applicant_name,p_email:parsed.data.applicant_email,p_identifier:parsed.data.applicant_identifier||"",p_phone:parsed.data.phone||"",p_statement:parsed.data.statement,p_experience:parsed.data.experience||"",p_website:parsed.data.website||""});
  if(error||!data?.receipt_token)redirect(`/convocatorias/${parsed.data.slug}?error=${encodeURIComponent(error?.message.includes("Ya existe")?"Ya existe una postulación para este correo":"No fue posible registrar la postulación. Revise los datos o la vigencia")}`);
  redirect(`/convocatorias/postulacion/confirmacion?receipt=${encodeURIComponent(String(data.receipt_token))}`);
}

export type PublicApplicationStatus={processTitle:string;positionTitle:string;institutionName:string;dependencyName:string;applicantName:string;submittedAt:string;status:string;updatedAt:string;message:string|null};
export type ApplicationLookupState={error?:string;result?:PublicApplicationStatus};
export async function lookupSelectionApplicationStatus(_:ApplicationLookupState,formData:FormData):Promise<ApplicationLookupState>{
  const parsed=z.object({tracking_code:z.string().trim().min(12).max(40),email:z.string().trim().email().max(320)}).safeParse(Object.fromEntries(formData));
  if(!parsed.success)return {error:"No se encontró una postulación con los datos ingresados."};
  const supabase=await createClient();if(!supabase)return {error:"No fue posible consultar el estado en este momento."};
  const {data,error}=await supabase.rpc("lookup_selection_application_status",{p_tracking_code:parsed.data.tracking_code,p_email:parsed.data.email});const row=data?.[0];
  if(error||!row)return {error:"No se encontró una postulación con los datos ingresados."};
  return {result:{processTitle:row.process_title,positionTitle:row.position_title,institutionName:row.institution_name,dependencyName:row.dependency_name,applicantName:row.applicant_name,submittedAt:row.submitted_at,status:row.public_status,updatedAt:row.public_updated_at,message:row.public_message}};
}
function slugify(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"convocatoria";}
