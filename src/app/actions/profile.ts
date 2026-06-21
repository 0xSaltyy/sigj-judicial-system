"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireInternalUser } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { can, enforcePermission, PERMISSIONS } from "@/lib/auth/permissions";
import { dbUuid } from "@/lib/validation";

const imageTypes = new Set(["image/png","image/jpeg","image/webp"]);
function fail(message:string):never{redirect(`/admin/perfil?error=${encodeURIComponent(message)}`)}
const optionalUuid = dbUuid.optional().or(z.literal(""));

export async function updateSelfProfile(formData: FormData) {
  const parsed = z.object({
    full_name: z.string().trim().min(3).max(140), public_display_name: z.string().trim().max(140).optional(),
    position_title: z.string().trim().max(160).optional(), public_title: z.string().trim().max(160).optional(),
    public_bio: z.string().trim().max(1200).optional(), public_phone: z.string().trim().max(80).optional(),
    institution_id: optionalUuid, dependency_id: optionalUuid, public_institution_id: optionalUuid, public_dependency_id: optionalUuid,
    public_profile: z.string().optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const session = await requireInternalUser();
  await enforcePermission(session, PERMISSIONS.profileEdit, session.user.id);
  await enforcePermission(session, PERMISSIONS.usersEditOwn, session.user.id);
  const admin = createAdminClient(); if (!admin) fail("Servicio de perfil no configurado");
  const { data: current } = await admin.from("profiles").select("id,full_name,position_title,institution_id,dependency_id,public_display_name,public_title,public_bio,public_phone,public_profile,public_institution_id,public_dependency_id,is_owner,role").eq("id",session.user.id).maybeSingle();
  if (!current) fail("El perfil institucional no está disponible");
  const [editPublic, publish, editInstitution, editDependency, editTitle] = await Promise.all([
    can(session.profile,"edit_public","perfil",{supabase:session.supabase}), can(session.profile,"publish_profile","perfil",{supabase:session.supabase}),
    can(session.profile,"edit_institution","perfil",{supabase:session.supabase}), can(session.profile,"edit_dependency","perfil",{supabase:session.supabase}),
    can(session.profile,"edit_title","perfil",{supabase:session.supabase}),
  ]);
  const deny = async (message:string):Promise<never> => { await admin.from("audit_logs").insert({user_id:session.user.id,target_user_id:session.user.id,action:"SELF_PROFILE_EDIT_DENIED",table_name:"profiles",record_id:session.user.id,description:message,metadata:{source:"self_profile"}}); fail(message); };
  const requestedPublic = parsed.data.public_profile === "true";
  const requestedInstitution = parsed.data.institution_id || null;
  const requestedDependency = parsed.data.dependency_id || null;
  if (!publish && requestedPublic !== current.public_profile) await deny("Solo un administrador autorizado puede publicar este perfil");
  if (!editInstitution && requestedInstitution !== current.institution_id) await deny("No tiene permiso para cambiar su institución");
  if (!editDependency && requestedDependency !== current.dependency_id) await deny("No tiene permiso para cambiar su dependencia o despacho");
  if (!editTitle && (parsed.data.position_title || null) !== current.position_title) await deny("No tiene permiso para cambiar su cargo institucional");
  if (!editPublic && ["public_display_name","public_title","public_bio","public_phone","public_institution_id","public_dependency_id"].some((key) => String(formData.get(key) || "") !== String((current as Record<string, unknown>)[key] || ""))) await deny("No tiene permiso para editar la identidad pública");
  const { data: dependencies } = await admin.from("dependencies").select("id,parent_id,is_active,archived_at");
  const tree = dependencies ?? [];
  const valid = (id: string | null) => !id || tree.some((item) => item.id === id && item.is_active && !item.archived_at);
  if (!valid(requestedInstitution) || !valid(requestedDependency) || !valid(parsed.data.public_institution_id || null) || !valid(parsed.data.public_dependency_id || null)) fail("La institución o dependencia seleccionada no está disponible");
  const within = (child: string | null, parent: string | null) => { if (!child || !parent) return false; const byId=new Map(tree.map((item)=>[item.id,item])); let item=byId.get(child); const seen=new Set<string>(); while(item&&!seen.has(item.id)){if(item.id===parent)return true;seen.add(item.id);item=item.parent_id?byId.get(item.parent_id):undefined;} return false; };
  if (!session.profile.is_owner && session.profile.role === "ADMIN_INSTITUCIONAL" && requestedDependency && !within(requestedDependency,current.institution_id)) await deny("Solo puede elegir dependencias dentro de su institución");
  if (!session.profile.is_owner && parsed.data.public_dependency_id && parsed.data.public_dependency_id !== requestedDependency) await deny("La dependencia pública debe coincidir con su despacho asignado");
  if (!session.profile.is_owner && parsed.data.public_institution_id && parsed.data.public_institution_id !== requestedInstitution) await deny("La institución pública debe coincidir con su institución asignada");
  const next = {
    full_name: parsed.data.full_name, position_title: editTitle ? parsed.data.position_title || null : current.position_title,
    institution_id: editInstitution ? requestedInstitution : current.institution_id, dependency_id: editDependency ? requestedDependency : current.dependency_id,
    public_display_name: editPublic ? parsed.data.public_display_name || null : current.public_display_name,
    public_title: editPublic ? parsed.data.public_title || null : current.public_title, public_bio: editPublic ? parsed.data.public_bio || null : current.public_bio,
    public_phone: editPublic ? parsed.data.public_phone || null : current.public_phone,
    public_institution_id: editPublic ? parsed.data.public_institution_id || null : current.public_institution_id,
    public_dependency_id: editPublic ? parsed.data.public_dependency_id || null : current.public_dependency_id,
    public_profile: publish ? requestedPublic : current.public_profile,
  };
  const { error } = await admin.from("profiles").update(next).eq("id",session.user.id); if(error) fail("No fue posible guardar el perfil");
  const changed = Object.fromEntries(Object.entries(next).filter(([key,value]) => value !== (current as Record<string,unknown>)[key]));
  const oldValues=Object.fromEntries(Object.keys(changed).map((key)=>[key,(current as Record<string,unknown>)[key]]));
  const auditRows=[{user_id:session.user.id,target_user_id:session.user.id,action:"SELF_PROFILE_UPDATED",table_name:"profiles",record_id:session.user.id,description:"Perfil institucional propio actualizado",old_values:oldValues,new_values:changed,metadata:{source:"self_profile"}}];
  if(next.public_profile!==current.public_profile)auditRows.push({...auditRows[0],action:next.public_profile?"PUBLIC_PROFILE_ENABLED":"PUBLIC_PROFILE_DISABLED",description:next.public_profile?"Perfil institucional publicado":"Perfil institucional retirado del panel público"});
  if(next.institution_id!==current.institution_id||next.dependency_id!==current.dependency_id)auditRows.push({...auditRows[0],action:"SELF_PROFILE_PLACEMENT_UPDATED",description:"Institución o dependencia propia actualizada"});
  if(["public_display_name","public_title","public_bio","public_phone","public_institution_id","public_dependency_id"].some((key)=>key in changed))auditRows.push({...auditRows[0],action:"PUBLIC_PROFILE_UPDATED",description:"Identidad pública institucional actualizada"});
  await admin.from("audit_logs").insert(auditRows);
  revalidatePath("/admin","layout"); revalidatePath("/instituciones","layout"); redirect("/admin/perfil?success=Perfil%20institucional%20actualizado");
}

export async function uploadProfilePhoto(formData:FormData){
  const {user}=await requireInternalUser(); const admin=createAdminClient(); if(!admin)fail("Almacenamiento no configurado");
  const file=formData.get("photo"); if(!(file instanceof File)||!file.size)fail("Seleccione una imagen");
  if(!imageTypes.has(file.type)||file.size>1024*1024)fail("Use PNG, JPG o WebP de máximo 1 MB");
  const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg"; const path=`${user.id}/avatar.${ext}`;
  const {error}=await admin.storage.from("profile-assets").upload(path,file,{contentType:file.type,upsert:true}); if(error)fail(error.message);
  const {error:updateError}=await admin.from("profiles").update({avatar_path:path}).eq("id",user.id); if(updateError)fail(updateError.message);
  await admin.from("audit_logs").insert({user_id:user.id,target_user_id:user.id,action:"PROFILE_PHOTO_UPDATED",table_name:"profiles",record_id:user.id,description:"Foto de perfil actualizada",metadata:{private_storage:true}});
  revalidatePath("/admin","layout"); redirect("/admin/perfil?success=Foto%20de%20perfil%20actualizada");
}

export async function uploadDefaultSignature(formData:FormData){
  const {user}=await requireInternalUser(); const admin=createAdminClient(); if(!admin)fail("Almacenamiento no configurado");
  const file=formData.get("signature"); if(!(file instanceof File)||!file.size)fail("Seleccione una firma PNG");
  if(file.type!=="image/png"||file.size>1024*1024)fail("La firma predeterminada debe ser PNG de máximo 1 MB");
  const bytes=Buffer.from(await file.arrayBuffer()); const png=[137,80,78,71,13,10,26,10]; if(bytes.length<24||!png.every((v,i)=>bytes[i]===v))fail("El archivo PNG no es válido");
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20); if(width<200||height<80||width>5000||height>3000)fail("La firma debe medir entre 200×80 y 5000×3000 px");
  const path=`${user.id}/default-signature.png`; const {error}=await admin.storage.from("profile-assets").upload(path,bytes,{contentType:"image/png",upsert:true}); if(error)fail(error.message);
  const {error:updateError}=await admin.from("profiles").update({default_signature_path:path}).eq("id",user.id); if(updateError)fail(updateError.message);
  await admin.from("audit_logs").insert({user_id:user.id,target_user_id:user.id,action:"DEFAULT_SIGNATURE_UPDATED",table_name:"profiles",record_id:user.id,description:"Firma predeterminada privada actualizada",metadata:{requires_confirmation_for_use:true}});
  revalidatePath("/admin/perfil"); redirect("/admin/perfil?success=Firma%20predeterminada%20guardada");
}

export async function removeDefaultSignature(){
  const {user,profile}=await requireInternalUser(); const admin=createAdminClient(); if(!admin)fail("Almacenamiento no configurado");
  if(profile.default_signature_path)await admin.storage.from("profile-assets").remove([profile.default_signature_path]);
  await admin.from("profiles").update({default_signature_path:null}).eq("id",user.id);
  await admin.from("audit_logs").insert({user_id:user.id,target_user_id:user.id,action:"DEFAULT_SIGNATURE_REMOVED",table_name:"profiles",record_id:user.id,description:"Firma predeterminada eliminada"});
  revalidatePath("/admin/perfil"); redirect("/admin/perfil?success=Firma%20predeterminada%20eliminada");
}
