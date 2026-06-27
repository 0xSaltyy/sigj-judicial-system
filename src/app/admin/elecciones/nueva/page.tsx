import { AdminPageHeader } from "@/components/admin-page";
import { ElectionForm } from "@/components/election-form";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function NewElectionPage(){
  const {supabase}=await requirePermission(PERMISSIONS.electionsCreate);
  const {data:dependencies}=await supabase.from("dependencies").select("id,name,parent_id").eq("is_active",true).is("archived_at",null).order("name");
  return <><AdminPageHeader title="Nueva elección" description="Cree una elección institucional con escrutinio y publicación controlada."/><ElectionForm dependencies={dependencies??[]}/></>;
}
