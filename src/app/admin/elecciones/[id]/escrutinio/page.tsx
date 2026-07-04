import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleAlert, Clock3, Eye } from "lucide-react";
import { reviewElectionVote } from "@/app/actions/elections";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader, MetricCard } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { VOTE_STATUS_LABELS, statusLabel } from "@/lib/elections";

type CountBatch = { status: string; option_counts: Record<string, number> | null; annulled_votes: number; rejected_votes: number };

export default async function ElectionScrutiny({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;success?:string;q?:string;status?:string;source?:string}>}){
  const [{id},query,{supabase}]=await Promise.all([params,searchParams,requirePermission(PERMISSIONS.electionsScrutiny)]);
  const [{data:election},{data:votes},{data:options},{data:countBatches}]=await Promise.all([
    supabase.from("elections").select("id,title").eq("id",id).maybeSingle(),
    supabase.from("election_votes").select("id,receipt_code,source,discord_username,visible_name,status,submitted_at,duplicate_candidate,selected:election_options(candidate_name)").eq("election_id",id).order("submitted_at",{ascending:false}),
    supabase.from("election_options").select("id,candidate_name,display_order").eq("election_id",id).order("display_order"),
    supabase.from("election_count_batches").select("status,option_counts,annulled_votes,rejected_votes").eq("election_id",id),
  ]);
  if(!election)notFound();
  const rows=(votes??[]).filter((v)=>{const text=`${v.receipt_code} ${v.discord_username??""} ${one(v.selected)?.candidate_name??""}`.toLowerCase();return (!query.q||text.includes(query.q.toLowerCase()))&&(!query.status||v.status===query.status)&&(!query.source||v.source===query.source)});
  const count=(status:string)=>votes?.filter((v)=>v.status===status).length??0;
  const batches=(countBatches??[]) as CountBatch[];
  const submittedBatches=batches.filter((batch)=>batch.status==="submitted");
  const submittedVotes=sumBatches(submittedBatches);
  return <><AdminPageHeader title="Escrutinio electoral" description={election.title} action={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}`}>Volver</Link></Button><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}/resultados`}>Conteo electoral</Link></Button></div>}/><ActionMessage error={query.error} success={query.success}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Votos online pendientes" value={String(count("pending_validation"))} detail="Recibidos por portal" icon={<Clock3 className="size-5"/>}/><MetricCard label="Lotes generales" value={String(submittedBatches.length)} detail={`${submittedVotes.toLocaleString("es-CO")} votos en revisión`} icon={<Eye className="size-5"/>}/><MetricCard label="Online válidos" value={String(count("valid"))} detail="Cuentan en resultados online" icon={<CheckCircle2 className="size-5"/>}/><MetricCard label="Online no válidos" value={String(count("annulled")+count("rejected")+count("duplicate"))} detail="Anulados/rechazados" icon={<CircleAlert className="size-5"/>}/></div>
    <details className="mb-5 rounded-xl border bg-amber-50 p-4 text-sm text-amber-950">
      <summary className="cursor-pointer font-semibold">¿Qué significa esto?</summary>
      <p className="mt-2 leading-6">Esta página conserva la revisión de votos online. La carga y revisión de lotes agregados por tarjeta electoral se gestiona en Conteo electoral, sin división por municipios o ciudades.</p>
    </details>
    {submittedBatches.length>0&&<section className="mb-5 rounded-xl border bg-white p-5 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-[#153553]">Hay lotes generales en revisión</h2><p className="mt-1 text-muted-foreground">Valide, devuelva o rechace estos lotes desde el panel de Conteo electoral.</p></div><Button asChild><Link href={`/admin/elecciones/${id}/resultados`}>Revisar lotes</Link></Button></div></section>}
    <form className="mb-5 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4"><Input name="q" defaultValue={query.q} placeholder="Comprobante, Discord u opción"/><select name="status" defaultValue={query.status??""} className="h-9 rounded-md border px-3 text-sm"><option value="">Todos los estados</option>{Object.entries(VOTE_STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select name="source" defaultValue={query.source??""} className="h-9 rounded-md border px-3 text-sm"><option value="">Todas las fuentes</option><option value="online">Online</option><option value="manual">Manual</option></select><Button type="submit">Filtrar votos online</Button></form>
    <section className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-3">Comprobante</th><th className="p-3">Fuente</th><th className="p-3">Discord</th><th className="p-3">Opción</th><th className="p-3">Estado</th><th className="p-3">Fecha</th><th className="p-3">Acciones</th></tr></thead><tbody>{rows.map((v)=><tr key={v.id} className="border-b align-top"><td className="p-3 font-mono text-xs">{v.receipt_code}</td><td className="p-3">{v.source}</td><td className="p-3">{v.discord_username??"—"}{v.duplicate_candidate&&<Badge variant="outline" className="ml-2 border-amber-200 bg-amber-50">Posible duplicado</Badge>}</td><td className="p-3">{one(v.selected)?.candidate_name??"—"}</td><td className="p-3"><Badge variant="outline">{statusLabel(VOTE_STATUS_LABELS,v.status)}</Badge></td><td className="p-3">{formatDate(v.submitted_at)}</td><td className="p-3"><div className="flex flex-wrap gap-1">{["valid","observed","annulled","rejected","duplicate"].map((status)=><form key={status} action={reviewElectionVote}><input type="hidden" name="election_id" value={id}/><input type="hidden" name="vote_id" value={v.id}/><input type="hidden" name="status" value={status}/><SubmitButton size="sm" variant="outline" pendingLabel="…">{statusLabel(VOTE_STATUS_LABELS,status)}</SubmitButton></form>)}</div></td></tr>)}</tbody></table>{!rows.length&&<p className="p-8 text-center text-sm text-muted-foreground">No hay votos con los filtros actuales.</p>}</section>
    <p className="mt-4 text-xs text-muted-foreground">Opciones configuradas: {options?.map((o)=>o.candidate_name).join(" · ")}</p></>;
}
function one<T>(v:T|T[]|null|undefined):T|null{return Array.isArray(v)?v[0]??null:v??null;}
function sumCounts(counts:Record<string,number>|null|undefined){return Object.values(counts??{}).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0);}
function sumBatches(batches:CountBatch[]){return batches.reduce((sum,batch)=>sum+sumCounts(batch.option_counts)+Number(batch.annulled_votes??0)+Number(batch.rejected_votes??0),0);}
function formatDate(value:string){return new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}
