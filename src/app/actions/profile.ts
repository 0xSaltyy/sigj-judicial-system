"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireInternalUser } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

const imageTypes = new Set(["image/png","image/jpeg","image/webp"]);
function fail(message:string):never{redirect(`/admin/perfil?error=${encodeURIComponent(message)}`)}

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
