import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleAlert, Clock3, Eye } from "lucide-react";
import { reviewElectionVote } from "@/app/actions/elections";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader, MetricCard } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { VOTE_STATUS_LABELS, statusLabel } from "@/lib/elections";

export default async function ElectionScrutiny({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;success?:string;q?:string;status?:string;source?:string}>}){
  const [{id},query,{supabase}]=await Promise.all([params,searchParams,requirePermission(PERMISSIONS.electionsScrutiny)]);
  const [{data:election},{data:votes},{data:options}]=await Promise.all([supabase.from("elections").select("id,title").eq("id",id).maybeSingle(),supabase.from("election_votes").select("id,receipt_code,source,discord_username,visible_name,status,submitted_at,duplicate_candidate,selected:election_options(candidate_name)").eq("election_id",id).order("submitted_at",{ascending:false}),supabase.from("election_options").select("id,candidate_name").eq("election_id",id).order("display_order")]);
  if(!election)notFound();
  const rows=(votes??[]).filter((v)=>{const text=`${v.receipt_code} ${v.discord_username??""} ${one(v.selected)?.candidate_name??""}`.toLowerCase();return (!query.q||text.includes(query.q.toLowerCase()))&&(!query.status||v.status===query.status)&&(!query.source||v.source===query.source)});
  const count=(status:string)=>votes?.filter((v)=>v.status===status).length??0;
  return <><AdminPageHeader title="Escrutinio electoral" description={election.title} action={<Button asChild variant="outline"><Link href={`/admin/elecciones/${id}`}>Volver</Link></Button>}/><ActionMessage error={query.error} success={query.success}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Pendientes" value={String(count("pending_validation"))} detail="Sin validación" icon={<Clock3 className="size-5"/>}/><MetricCard label="Observados" value={String(count("observed"))} detail="En revisión" icon={<Eye className="size-5"/>}/><MetricCard label="Válidos" value={String(count("valid"))} detail="Cuentan en resultados" icon={<CheckCircle2 className="size-5"/>}/><MetricCard label="No válidos" value={String(count("annulled")+count("rejected")+count("duplicate"))} detail="Anulados/rechazados" icon={<CircleAlert className="size-5"/>}/></div>
    <form className="mb-5 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4"><Input name="q" defaultValue={query.q} placeholder="Comprobante, Discord u opción"/><select name="status" defaultValue={query.status??""} className="h-9 rounded-md border px-3 text-sm"><option value="">Todos los estados</option>{Object.entries(VOTE_STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select name="source" defaultValue={query.source??""} className="h-9 rounded-md border px-3 text-sm"><option value="">Todas las fuentes</option><option value="online">Online</option><option value="manual">Manual</option></select><Button type="submit">Filtrar</Button></form>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-3">Comprobante</th><th className="p-3">Fuente</th><th className="p-3">Discord</th><th className="p-3">Opción</th><th className="p-3">Estado</th><th className="p-3">Fecha</th><th className="p-3">Acciones</th></tr></thead><tbody>{rows.map((v)=><tr key={v.id} className="border-b align-top"><td className="p-3 font-mono text-xs">{v.receipt_code}</td><td className="p-3">{v.source}</td><td className="p-3">{v.discord_username??"—"}{v.duplicate_candidate&&<Badge variant="outline" className="ml-2 border-amber-200 bg-amber-50">Posible duplicado</Badge>}</td><td className="p-3">{one(v.selected)?.candidate_name??"—"}</td><td className="p-3"><Badge variant="outline">{statusLabel(VOTE_STATUS_LABELS,v.status)}</Badge></td><td className="p-3">{formatDate(v.submitted_at)}</td><td className="p-3"><div className="flex flex-wrap gap-1">{["valid","observed","annulled","rejected","duplicate"].map((status)=><form key={status} action={reviewElectionVote}><input type="hidden" name="election_id" value={id}/><input type="hidden" name="vote_id" value={v.id}/><input type="hidden" name="status" value={status}/><SubmitButton size="sm" variant="outline" pendingLabel="…">{statusLabel(VOTE_STATUS_LABELS,status)}</SubmitButton></form>)}</div></td></tr>)}</tbody></table>{!rows.length&&<p className="p-8 text-center text-sm text-muted-foreground">No hay votos con los filtros actuales.</p>}</div>
    <p className="mt-4 text-xs text-muted-foreground">Opciones configuradas: {options?.map((o)=>o.candidate_name).join(" · ")}</p></>;
}
function one<T>(v:T|T[]|null|undefined):T|null{return Array.isArray(v)?v[0]??null:v??null}
function formatDate(value:string){return new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}
