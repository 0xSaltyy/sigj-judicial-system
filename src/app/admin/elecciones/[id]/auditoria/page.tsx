import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function ElectionAudit({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;success?:string}>}){
  const [{id},query,{supabase}]=await Promise.all([params,searchParams,requirePermission(PERMISSIONS.electionsAudit)]);
  const {data:election}=await supabase.from("elections").select("id,title").eq("id",id).maybeSingle();if(!election)notFound();
  const {data:logs}=await supabase.from("audit_logs").select("id,action,description,created_at,metadata").or(`record_id.eq.${id},metadata->>election_id.eq.${id}`).order("created_at",{ascending:false}).limit(100);
  return <><AdminPageHeader title="Auditoría electoral" description={election.title} action={<Button asChild variant="outline"><Link href={`/admin/elecciones/${id}`}>Volver</Link></Button>}/><ActionMessage error={query.error} success={query.success}/><div className="rounded-xl border bg-white p-5"><ul className="space-y-3">{logs?.map((log)=><li key={log.id} className="border-l-2 pl-3 text-sm"><p className="font-semibold">{log.action}</p><p>{log.description}</p><time className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(log.created_at))}</time></li>)}{!logs?.length&&<li className="text-sm text-muted-foreground">Sin eventos auditados disponibles.</li>}</ul></div></>;
}
