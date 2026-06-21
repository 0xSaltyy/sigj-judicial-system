import { Camera, PenLine, Trash2, UserRound } from "lucide-react";
import Image from "next/image";
import { removeDefaultSignature, updateSelfProfile, uploadDefaultSignature, uploadProfilePhoto } from "@/app/actions/profile";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireInternalUser } from "@/lib/auth/authorization";
import { can } from "@/lib/auth/permissions";
import { profileAssetDataUrl } from "@/lib/profile-assets";
import { maskEmail, ROLE_DESCRIPTIONS, type AppRole } from "@/lib/user-management";
import { DraftForm } from "@/components/draft-form";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const [session, query] = await Promise.all([requireInternalUser(), searchParams]);
  const { supabase, profile: authProfile } = session;
  const [{ data: profile }, { data: dependencies }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,role,position_title,institution_id,dependency_id,avatar_path,default_signature_path,is_owner,public_profile,public_display_name,public_title,public_bio,public_phone,public_institution_id,public_dependency_id").eq("id",authProfile.id).maybeSingle(),
    supabase.from("dependencies").select("id,parent_id,name,type,level,is_active,archived_at").eq("is_active",true).is("archived_at",null).order("level").order("name"),
  ]);
  if (!profile) return null;
  const [avatar, signature, editPublic, publish, editInstitution, editDependency, editTitle] = await Promise.all([
    profileAssetDataUrl(profile.avatar_path), profileAssetDataUrl(profile.default_signature_path),
    can(authProfile,"edit_public","perfil",{supabase}), can(authProfile,"publish_profile","perfil",{supabase}),
    can(authProfile,"edit_institution","perfil",{supabase}), can(authProfile,"edit_dependency","perfil",{supabase}), can(authProfile,"edit_title","perfil",{supabase}),
  ]);
  const all = dependencies ?? [];
  const institutions = all.filter((item)=>item.level<=2 || /corte|tribunal|instituci|sistema/i.test(`${item.type} ${item.name}`));
  const names = new Map(all.map((item)=>[item.id,item.name]));
  const role = profile.role as AppRole;
  const publicName = profile.public_display_name || profile.full_name;
  const publicTitle = profile.public_title || profile.position_title || "Miembro institucional";
  return <>
    <AdminPageHeader title="Mi perfil institucional" description="Administre su identidad institucional, foto y firma privada sin modificar permisos protegidos." />
    <ActionMessage error={query.error} success={query.success} />
    <Card className="mb-5"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserRound className="size-4"/> Identidad y pertenencia institucional</CardTitle></CardHeader><CardContent>
      <DraftForm action={updateSelfProfile} storageKey={`sigj:self-profile:${profile.id}`} className="grid gap-5 md:grid-cols-2">
        <Field id="profile-full-name" label="Nombre visible en el sistema"><Input id="profile-full-name" name="full_name" defaultValue={profile.full_name} required /></Field>
        <ReadOnly label="Correo institucional" value={profile.is_owner ? "Correo protegido" : maskEmail(profile.email)} />
        <ReadOnly label="Rol del sistema" value={ROLE_DESCRIPTIONS[role]?.label || role} />
        <ReadOnly label="Protección de cuenta" value={profile.is_owner ? "Cuenta propietaria protegida" : "Cuenta institucional"} />
        <ControlledSelect label="Institución / corporación" name="institution_id" value={profile.institution_id} editable={editInstitution} options={institutions.map((item)=>({value:item.id,label:item.name}))} empty="Sin institución" />
        <ControlledSelect label="Dependencia / despacho / sala / juzgado" name="dependency_id" value={profile.dependency_id} editable={editDependency} options={all.map((item)=>({value:item.id,label:item.name}))} empty="Sin dependencia" />
        <Field id="profile-position" label="Cargo / título institucional" helper={!editTitle ? "Para cambiar el cargo, contacte a un administrador autorizado." : undefined}><Input id="profile-position" name="position_title" defaultValue={profile.position_title || ""} disabled={!editTitle}/>{!editTitle&&<input type="hidden" name="position_title" value={profile.position_title || ""}/>}</Field>

        <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-5"><h2 className="font-semibold text-blue-950">Perfil público institucional</h2><p className="mt-1 text-xs leading-5 text-blue-900">Solo se mostrará información institucional segura: nombre, cargo, foto, institución/dependencia y biografía pública. No se mostrará correo, permisos, firma privada ni etiquetas internas.</p></div>
        <Field id="profile-public-name" label="Nombre público"><Input id="profile-public-name" name="public_display_name" defaultValue={profile.public_display_name || ""} disabled={!editPublic}/></Field>
        <Field id="profile-public-title" label="Cargo público"><Input id="profile-public-title" name="public_title" defaultValue={profile.public_title || ""} disabled={!editPublic}/></Field>
        <div className="md:col-span-2"><Field id="profile-public-bio" label="Biografía pública"><Textarea id="profile-public-bio" name="public_bio" defaultValue={profile.public_bio || ""} maxLength={1200} disabled={!editPublic}/></Field></div>
        <Field id="profile-public-phone" label="Teléfono u oficina pública"><Input id="profile-public-phone" name="public_phone" defaultValue={profile.public_phone || ""} disabled={!editPublic}/></Field>
        <ControlledSelect label="Institución visible" name="public_institution_id" value={profile.public_institution_id || profile.institution_id} editable={editPublic} options={institutions.map((item)=>({value:item.id,label:item.name}))} empty="Usar institución asignada" />
        <ControlledSelect label="Dependencia visible" name="public_dependency_id" value={profile.public_dependency_id || profile.dependency_id} editable={editPublic} options={all.map((item)=>({value:item.id,label:item.name}))} empty="Usar dependencia asignada" />
        {!editPublic && <><input type="hidden" name="public_display_name" value={profile.public_display_name || ""}/><input type="hidden" name="public_title" value={profile.public_title || ""}/><input type="hidden" name="public_bio" value={profile.public_bio || ""}/><input type="hidden" name="public_phone" value={profile.public_phone || ""}/></>}
        <label className="flex items-start gap-3 rounded border p-4 text-sm md:col-span-2"><input type="checkbox" name="public_profile" value="true" defaultChecked={profile.public_profile} disabled={!publish} className="mt-1"/><span><strong>Mostrar mi perfil en el panel público.</strong><small className="mt-1 block text-muted-foreground">{publish ? "Puede activar o desactivar la publicación directamente." : "Solo un administrador autorizado puede publicar este perfil."}</small></span>{!publish&&<input type="hidden" name="public_profile" value={String(profile.public_profile)}/>}</label>
        <div className="min-w-0 md:col-span-2"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vista previa de tarjeta pública</p><div className="flex max-w-lg min-w-0 items-center gap-4 overflow-hidden rounded-lg border bg-white p-4">{avatar?<Image src={avatar} alt="Vista previa de foto" width={64} height={64} unoptimized className="size-16 shrink-0 rounded-full object-cover"/>:<div className="grid size-16 shrink-0 place-items-center rounded-full bg-slate-100 text-xs">Sin foto</div>}<div className="min-w-0"><p className="break-words font-semibold">{publicName}</p><p className="break-words text-sm text-muted-foreground">{publicTitle}</p><p className="break-words text-xs text-muted-foreground">{names.get(profile.public_dependency_id || profile.dependency_id) || names.get(profile.public_institution_id || profile.institution_id) || "Sin ubicación pública"}</p>{profile.public_bio&&<p className="mt-2 line-clamp-4 break-words text-xs">{profile.public_bio}</p>}</div></div></div>
        <div className="flex justify-end md:col-span-2"><SubmitButton pendingLabel="Guardando perfil…">Guardar mi perfil</SubmitButton></div>
      </DraftForm>
    </CardContent></Card>
    <div className="grid min-w-0 gap-5 lg:grid-cols-2"><AssetCard title="Foto de perfil" icon={<Camera className="size-4"/>} description="Se usa en tarjetas de miembros, cabecera y directorios.">{avatar?<Image src={avatar} alt={`Foto de ${profile.full_name}`} width={112} height={112} unoptimized className="mb-4 size-28 rounded-full border object-cover"/>:<Placeholder>Sin foto</Placeholder>}<form action={uploadProfilePhoto} className="space-y-3"><Label htmlFor="profile-photo">Archivo de imagen</Label><input id="profile-photo" type="file" name="photo" accept="image/png,image/jpeg,image/webp" required className="block w-full text-sm"/><p className="text-xs text-muted-foreground">PNG, JPG o WebP · máximo 1 MB. Tras un error deberá seleccionar el archivo nuevamente.</p><SubmitButton pendingLabel="Subiendo…">Subir foto de perfil</SubmitButton></form></AssetCard>
      <AssetCard title="Firma predeterminada" icon={<PenLine className="size-4"/>} description="Es privada y solo se utiliza al confirmar una firma documental.">{signature?<div className="mb-4 flex h-28 items-center justify-center rounded border bg-white p-3"><Image src={signature} alt="Firma predeterminada guardada" width={420} height={112} unoptimized className="max-h-full max-w-full object-contain"/></div>:<Placeholder>Sin firma guardada</Placeholder>}<form action={uploadDefaultSignature} className="space-y-3"><Label htmlFor="profile-signature">Firma en formato PNG</Label><input id="profile-signature" type="file" name="signature" accept="image/png" required className="block w-full text-sm"/><p className="text-xs text-muted-foreground">PNG transparente · máximo 1 MB. Nunca se muestra en el perfil público.</p><SubmitButton pendingLabel="Guardando…">Subir firma predeterminada</SubmitButton></form>{signature&&<form action={removeDefaultSignature} className="mt-3"><Button type="submit" variant="outline"><Trash2 className="size-4"/> Eliminar firma guardada</Button></form>}</AssetCard></div>
  </>;
}

function Field({id,label,helper,children}:{id:string;label:string;helper?:string;children:React.ReactNode}){return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label>{children}{helper&&<p className="text-xs text-muted-foreground">{helper}</p>}</div>}
function ReadOnly({label,value}:{label:string;value:string}){return <div className="space-y-2"><Label>{label}</Label><div className="flex h-9 items-center rounded-md border bg-slate-50 px-3 text-sm"><Badge variant="outline">{value}</Badge></div></div>}
function ControlledSelect({label,name,value,editable,options,empty}:{label:string;name:string;value:string|null;editable:boolean;options:{value:string;label:string}[];empty:string}){const id=`profile-${name.replaceAll("_","-")}`;return <Field id={id} label={label} helper={!editable?"Para cambiar institución o dependencia, contacte a un administrador autorizado.":undefined}><select id={id} name={name} defaultValue={value||""} disabled={!editable} className="h-9 w-full min-w-0 rounded-md border px-3 text-sm"><option value="">{empty}</option>{options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select>{!editable&&<input type="hidden" name={name} value={value||""}/>}</Field>}
function AssetCard({title,icon,description,children}:{title:string;icon:React.ReactNode;description:string;children:React.ReactNode}){return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle><p className="text-xs text-muted-foreground">{description}</p></CardHeader><CardContent>{children}</CardContent></Card>}
function Placeholder({children}:{children:React.ReactNode}){return <div className="mb-4 flex h-28 items-center justify-center rounded border border-dashed text-sm text-muted-foreground">{children}</div>}
