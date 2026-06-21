import Link from "next/link";
import { redirect } from "next/navigation";
import { Network, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { InstitutionalTree } from "@/components/institutional-tree";
import { Button } from "@/components/ui/button";
import { requireInternalUser } from "@/lib/auth/authorization";
import { can, canManageDependency } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_DESCRIPTIONS, type AppRole } from "@/lib/user-management";

type Dependency={id:string;parent_id:string|null;name:string;type:string;code:string;level:number};
function within(child:string|null,parent:string|null,rows:Dependency[]){if(!child||!parent)return false;const map=new Map(rows.map((item)=>[item.id,item]));let item=map.get(child);const seen=new Set<string>();while(item&&!seen.has(item.id)){if(item.id===parent)return true;seen.add(item.id);item=item.parent_id?map.get(item.parent_id):undefined;}return false;}

export default async function StructurePage() {
  const session=await requireInternalUser();
  const [canViewDependencies,canViewInstitutions,canCreate,canEdit,canViewUsers]=await Promise.all([
    can(session.profile,"view","dependencias",{supabase:session.supabase}),
    can(session.profile,"view","instituciones",{supabase:session.supabase}),
    canManageDependency(session.profile,"create",{supabase:session.supabase}),
    canManageDependency(session.profile,"edit",{supabase:session.supabase}),
    can(session.profile,"view","usuarios",{supabase:session.supabase}),
  ]);
  if(!canViewDependencies&&!canViewInstitutions&&!canCreate&&!canEdit)redirect("/no-autorizado");
  const admin=createAdminClient();
  if(!admin)redirect("/admin/dependencias?error=No%20fue%20posible%20cargar%20la%20estructura%20institucional.");
  const [{data:allDependencies},{data:allMembers}]=await Promise.all([
    admin.from("dependencies").select("id,parent_id,name,type,code,level").eq("is_active",true).is("archived_at",null).order("level").order("name"),
    admin.from("profiles").select("id,full_name,position_title,role,institution_id,dependency_id,is_owner").eq("is_active",true).order("full_name"),
  ]);
  const rows=(allDependencies??[]) as Dependency[];
  const globalScope=session.profile.is_owner||session.profile.role==="SUPER_ADMIN";
  const scopeRoot=session.profile.institution_id||session.profile.dependency_id;
  const visible=globalScope?rows:rows.filter((item)=>within(item.id,scopeRoot,rows));
  const ids=new Set(visible.map((item)=>item.id));
  const members=(allMembers??[]).filter((item)=>ids.has(item.dependency_id||item.institution_id||""));
  return <>
    <AdminPageHeader title="Árbol institucional" description="Explore corporaciones, salas, despachos, juzgados y miembros dentro de su alcance efectivo." action={canCreate?<Button asChild className="bg-[#153b5c]"><Link href="/admin/dependencias"><Plus className="size-4"/> Crear dependencia o juzgado</Link></Button>:undefined}/>
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><Network className="mt-0.5 size-5 shrink-0"/><p className="min-w-0">La estructura respeta su institución o despacho asignado. Los datos privados de contacto, firmas y permisos no se muestran aquí.</p></div>
    <InstitutionalTree
      nodes={visible.map((item)=>({id:item.id,parentId:item.parent_id,name:item.name,type:item.type,code:item.code,level:item.level}))}
      members={members.map((item)=>({id:item.id,name:item.is_owner?"Lilith D'Amico":item.full_name,title:item.position_title||ROLE_DESCRIPTIONS[item.role as AppRole]?.label||"Miembro institucional",nodeId:item.dependency_id||item.institution_id||""}))}
      canEdit={canEdit}
      canViewUsers={canViewUsers}
    />
  </>;
}
