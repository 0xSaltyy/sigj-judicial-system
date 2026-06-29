import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleAlert, Clock3, Eye } from "lucide-react";
import { reviewElectionCityVoteBatch, reviewElectionVote } from "@/app/actions/elections";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader, MetricCard } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { VOTE_STATUS_LABELS, statusLabel } from "@/lib/elections";
import { VALLE_ELECTION_CITIES } from "@/lib/valle-del-cauca";

type BatchRow={id:string;city:string;status:string;option_counts:Record<string,number>|null;annulled_votes:number;rejected_votes:number;note:string|null;submitted_at:string|null;created_at:string;submitted_by_profile:{full_name:string|null}|{full_name:string|null}[]|null};

export default async function ElectionScrutiny({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;success?:string;q?:string;status?:string;source?:string}>}){
  const [{id},query,{supabase}]=await Promise.all([params,searchParams,requirePermission(PERMISSIONS.electionsScrutiny)]);
  const [{data:election},{data:votes},{data:options},{data:batches}]=await Promise.all([
    supabase.from("elections").select("id,title").eq("id",id).maybeSingle(),
    supabase.from("election_votes").select("id,receipt_code,source,discord_username,visible_name,status,submitted_at,duplicate_candidate,selected:election_options(candidate_name)").eq("election_id",id).order("submitted_at",{ascending:false}),
    supabase.from("election_options").select("id,candidate_name,display_order").eq("election_id",id).order("display_order"),
    supabase.from("election_territorial_city_batches").select("id,city,status,option_counts,annulled_votes,rejected_votes,note,submitted_at,created_at,submitted_by_profile:profiles!election_territorial_city_batches_submitted_by_fkey(full_name)").eq("election_id",id).order("created_at",{ascending:false}),
  ]);
  if(!election)notFound();
  const rows=(votes??[]).filter((v)=>{const text=`${v.receipt_code} ${v.discord_username??""} ${one(v.selected)?.candidate_name??""}`.toLowerCase();return (!query.q||text.includes(query.q.toLowerCase()))&&(!query.status||v.status===query.status)&&(!query.source||v.source===query.source)});
  const count=(status:string)=>votes?.filter((v)=>v.status===status).length??0;
  const territorial=(batches??[]) as BatchRow[];
  const territorialCount=(status:string)=>territorial.filter((batch)=>batch.status===status).length;
  return <><AdminPageHeader title="Escrutinio electoral" description={election.title} action={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}`}>Volver</Link></Button><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}/votos-territoriales`}>Votos territoriales</Link></Button></div>}/><ActionMessage error={query.error} success={query.success}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Pendientes" value={String(count("pending_validation"))} detail="Votos online/manuales sin validación" icon={<Clock3 className="size-5"/>}/><MetricCard label="Lotes territoriales" value={String(territorialCount("submitted"))} detail="En revisión" icon={<Eye className="size-5"/>}/><MetricCard label="Válidos" value={String(count("valid"))} detail="Cuentan en resultados" icon={<CheckCircle2 className="size-5"/>}/><MetricCard label="No válidos" value={String(count("annulled")+count("rejected")+count("duplicate"))} detail="Anulados/rechazados" icon={<CircleAlert className="size-5"/>}/></div>
    <details className="mb-5 rounded-xl border bg-amber-50 p-4 text-sm text-amber-950">
      <summary className="cursor-pointer font-semibold">¿Qué significa esto?</summary>
      <p className="mt-2 leading-6">Revise votos online, manuales y territoriales. Solo los lotes validados cuentan para la próxima actualización pública; borradores, lotes en revisión, devueltos y rechazados quedan fuera.</p>
    </details>
    <form className="mb-5 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4"><Input name="q" defaultValue={query.q} placeholder="Comprobante, Discord u opción"/><select name="status" defaultValue={query.status??""} className="h-9 rounded-md border px-3 text-sm"><option value="">Todos los estados</option>{Object.entries(VOTE_STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select name="source" defaultValue={query.source??""} className="h-9 rounded-md border px-3 text-sm"><option value="">Todas las fuentes</option><option value="online">Online</option><option value="manual">Manual</option></select><Button type="submit">Filtrar votos online</Button></form>
    <section className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-3">Comprobante</th><th className="p-3">Fuente</th><th className="p-3">Discord</th><th className="p-3">Opción</th><th className="p-3">Estado</th><th className="p-3">Fecha</th><th className="p-3">Acciones</th></tr></thead><tbody>{rows.map((v)=><tr key={v.id} className="border-b align-top"><td className="p-3 font-mono text-xs">{v.receipt_code}</td><td className="p-3">{v.source}</td><td className="p-3">{v.discord_username??"—"}{v.duplicate_candidate&&<Badge variant="outline" className="ml-2 border-amber-200 bg-amber-50">Posible duplicado</Badge>}</td><td className="p-3">{one(v.selected)?.candidate_name??"—"}</td><td className="p-3"><Badge variant="outline">{statusLabel(VOTE_STATUS_LABELS,v.status)}</Badge></td><td className="p-3">{formatDate(v.submitted_at)}</td><td className="p-3"><div className="flex flex-wrap gap-1">{["valid","observed","annulled","rejected","duplicate"].map((status)=><form key={status} action={reviewElectionVote}><input type="hidden" name="election_id" value={id}/><input type="hidden" name="vote_id" value={v.id}/><input type="hidden" name="status" value={status}/><SubmitButton size="sm" variant="outline" pendingLabel="…">{statusLabel(VOTE_STATUS_LABELS,status)}</SubmitButton></form>)}</div></td></tr>)}</tbody></table>{!rows.length&&<p className="p-8 text-center text-sm text-muted-foreground">No hay votos con los filtros actuales.</p>}</section>
    <section className="mt-6 rounded-xl border bg-white p-5">
      <h2 className="font-semibold text-[#153553]">Revisión de votos territoriales</h2>
      <p className="mt-1 text-sm text-muted-foreground">Lotes agrupados por ciudad. Cada lote representa votos nuevos que fueron enviados a revisión.</p>
      <div className="mt-5 grid gap-4">
        {VALLE_ELECTION_CITIES.map((city)=>{
          const cityBatches=territorial.filter((batch)=>batch.city===city);
          return <article key={city} className="rounded-xl border bg-slate-50 p-4"><h3 className="font-semibold text-[#153553]">{city}</h3><div className="mt-3 grid gap-3">{cityBatches.map((batch,index)=><div key={batch.id} className="rounded-lg border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">Lote #{cityBatches.length-index} — +{sumBatch(batch).toLocaleString("es-CO")} votos</p><p className="text-xs text-muted-foreground">Enviado por {profileName(batch.submitted_by_profile)} · {batch.submitted_at?formatDate(batch.submitted_at):formatDate(batch.created_at)}</p>{batch.note&&<p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-950">{batch.note}</p>}</div><Badge variant="outline">{batchStatus(batch.status)}</Badge></div><details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold text-[#153553]">Ver detalle técnico</summary><div className="mt-2 grid gap-1 text-muted-foreground">{Object.entries(batch.option_counts??{}).map(([key,value])=><p key={key}>{optionName(options??[],key)}: +{Number(value).toLocaleString("es-CO")}</p>)}<p>Anulados: +{Number(batch.annulled_votes??0).toLocaleString("es-CO")}</p><p>Rechazados/otros: +{Number(batch.rejected_votes??0).toLocaleString("es-CO")}</p></div></details>{batch.status==="submitted"&&<form action={reviewElectionCityVoteBatch} className="mt-3 grid gap-2"><input type="hidden" name="election_id" value={id}/><input type="hidden" name="batch_id" value={batch.id}/><Textarea name="note" placeholder="Explique qué debe corregirse para devolver o rechazar" className="min-h-16 text-xs"/><div className="flex flex-wrap gap-2"><SubmitButton name="status" value="validated" size="sm" pendingLabel="Validando…" confirmMessage="Este lote se sumará a los votos validados de la ciudad. ¿Continuar?">Validar lote</SubmitButton><SubmitButton name="status" value="returned" size="sm" variant="outline" pendingLabel="Devolviendo…" confirmMessage="Este lote será devuelto para corrección y no contará. ¿Continuar?">Devolver para corrección</SubmitButton><SubmitButton name="status" value="rejected" size="sm" variant="outline" pendingLabel="Rechazando…" confirmMessage="Este lote será rechazado y no contará. ¿Continuar?">Rechazar lote</SubmitButton></div></form>}</div>)}{!cityBatches.length&&<p className="rounded border border-dashed bg-white p-4 text-sm text-muted-foreground">No hay votos enviados a revisión.</p>}</div></article>;
        })}
      </div>
    </section>
    <p className="mt-4 text-xs text-muted-foreground">Opciones configuradas: {options?.map((o)=>o.candidate_name).join(" · ")}</p></>;
}
function one<T>(v:T|T[]|null|undefined):T|null{return Array.isArray(v)?v[0]??null:v??null}
function formatDate(value:string){return new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}
function optionName(options:Array<{id:string;candidate_name:string;display_order:number}>,key:string){const found=options.find((option)=>option.id===key);return found?`Tarjeta Electoral ${found.display_order} · ${found.candidate_name}`:key}
function sumCounts(counts:Record<string,number>|null|undefined){return Object.values(counts??{}).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0)}
function sumBatch(batch:BatchRow){return sumCounts(batch.option_counts)+Number(batch.annulled_votes??0)+Number(batch.rejected_votes??0)}
function batchStatus(value:string){return ({draft:"Borrador",submitted:"En revisión",validated:"Validado",returned:"Devuelto",rejected:"Rechazado",published:"Publicado"} as Record<string,string>)[value]??value}
function profileName(value:BatchRow["submitted_by_profile"]){const profile=Array.isArray(value)?value[0]:value;return profile?.full_name??"Usuario institucional";}
