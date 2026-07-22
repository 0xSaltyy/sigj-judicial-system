import Link from "next/link";
import { notFound } from "next/navigation";
import { configureElectionExpectedTotal, createElectionUpdateSnapshot, publishElectionResults, reviewElectionCountBatch } from "@/app/actions/elections";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ElectionCountEntryForm } from "@/components/election-count-entry-form";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { ELECTION_STATUS_LABELS, statusLabel } from "@/lib/elections";

type TotalRow = { option_id: string; candidate_name: string; is_blank_vote: boolean; display_order: number; card_label: string; admin_valid: number | string; online_valid: number | string; manual_valid: number | string; total_valid: number | string };
type OptionRow = { id: string; candidate_name: string; display_order: number };
type BatchRow = { id: string; status: string; option_counts: Record<string, number> | null; annulled_votes: number; rejected_votes: number; note: string | null; created_at: string; submitted_at: string | null };
type UpdateRow = { id: string; update_number: number; snapshot_type: string; progress_percentage: number | string; updated_at: string; note: string | null };

export default async function ElectionResultsAdmin({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;success?:string}>}){
  const [{id},query,{supabase}]=await Promise.all([params,searchParams,requirePermission(PERMISSIONS.electionsView)]);
  const [{data:election},{data:totals},{data:options},{data:batches},{data:updates},{data:acts}]=await Promise.all([
    supabase.from("elections").select("id,title,status,total_expected_votes,winner_option_id,winner_published_at").eq("id",id).maybeSingle(),
    supabase.rpc("election_count_totals",{p_election_id:id}),
    supabase.from("election_options").select("id,candidate_name,display_order").eq("election_id",id).eq("active",true).order("display_order"),
    supabase.from("election_count_batches").select("id,status,option_counts,annulled_votes,rejected_votes,note,created_at,submitted_at").eq("election_id",id).in("status",["draft","submitted","returned","rejected"]).order("created_at",{ascending:false}).limit(80),
    supabase.from("election_public_updates").select("id,update_number,snapshot_type,progress_percentage,updated_at,note").eq("election_id",id).eq("public_visible",true).order("update_number",{ascending:false}).limit(8),
    supabase.from("election_acts").select("id").eq("election_id",id).limit(1),
  ]);
  if(!election)notFound();

  const totalRows=(totals??[]) as TotalRow[];
  const optionRows=(options??[]) as OptionRow[];
  const batchRows=(batches??[]) as BatchRow[];
  const updateRows=(updates??[]) as UpdateRow[];
  const expected=Number(election.total_expected_votes??0);
  const totalValid=totalRows.reduce((sum,row)=>sum+Number(row.total_valid??0),0);
  const inReview=sumBatches(batchRows.filter((batch)=>batch.status==="submitted"));
  const returned=batchRows.filter((batch)=>batch.status==="returned");
  const rejected=batchRows.filter((batch)=>batch.status==="rejected");
  const draft=batchRows.filter((batch)=>batch.status==="draft");
  const progress=expected>0?Math.min(100,(totalValid/expected)*100):0;
  const remaining=expected>0?Math.max(0,expected-totalValid-inReview):0;
  const latestProgress=Number(updateRows[0]?.progress_percentage??0);
  const hasValidatedUnpublished=progress>latestProgress;
  const actReady=Boolean(acts?.length);
  const max=Math.max(1,...totalRows.map((row)=>Number(row.total_valid)||0));

  return <><AdminPageHeader title="Conteo electoral" description={`${election.title} · ${statusLabel(ELECTION_STATUS_LABELS,election.status)}`} action={<Button asChild variant="outline"><Link href={`/admin/elecciones/${id}`}>Volver</Link></Button>}/><ActionMessage error={query.error} success={query.success}/>
    <details className="mb-5 rounded-xl border bg-amber-50 p-4 text-sm text-amber-950">
      <summary className="cursor-pointer font-semibold">¿Qué significa esto?</summary>
      <p className="mt-2 leading-6">El flujo normal usa un total esperado único de la elección. Se agregan lotes de votos por tarjeta electoral, se revisan/validan y solo después una actualización humana publica porcentajes. El sistema prepara el acta al llegar al 100%, pero los resultados definitivos y el ganador oficial siguen siendo decisiones manuales autorizadas.</p>
    </details>
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Info title="Total esperado" detail={expected?expected.toLocaleString("es-CO"):"Sin configurar"}/>
      <Info title="Validado/publicado" detail={`${totalValid.toLocaleString("es-CO")} votos · ${formatPercent(progress)}`}/>
      <Info title="En revisión" detail={`${inReview.toLocaleString("es-CO")} votos pendientes`}/>
      <Info title="Restante" detail={expected?`${remaining.toLocaleString("es-CO")} votos`:"Configure el total primero"}/>
      <Info title="Avance del escrutinio" detail={formatPercent(progress)}/>
      <Info title="Última actualización pública" detail={updateRows[0]?`#${updateRows[0].update_number} · ${formatPercent(Number(updateRows[0].progress_percentage))}`:"Sin publicar"}/>
    </section>
    {(expected<=0||inReview>0||draft.length>0||returned.length>0||rejected.length>0||hasValidatedUnpublished||progress>=100)&&<section className="mb-5 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      {expected<=0&&<p>Configure el total esperado de votos antes de agregar o publicar conteos.</p>}
      {draft.length>0&&<p>Hay {draft.length} borrador(es) guardado(s) que aún no cuentan ni están en revisión.</p>}
      {inReview>0&&<p>Hay votos enviados a revisión que requieren validación, devolución o rechazo.</p>}
      {returned.length>0&&<p>Hay {returned.length} lote(s) devuelto(s) para corrección.</p>}
      {rejected.length>0&&<p>Hay {rejected.length} lote(s) rechazado(s) registrados en auditoría.</p>}
      {hasValidatedUnpublished&&<p>Existen votos validados no incluidos todavía en la última actualización pública.</p>}
      {progress>=100&&<p>El conteo llegó al 100%; {actReady?"el acta electoral ya está preparada.":"al publicar o revisar, el sistema preparará el acta electoral."}</p>}
    </section>}
    <section className="mb-5 rounded-xl border bg-white p-5">
      <h2 className="font-semibold text-[#153553]">Configurar total esperado</h2>
      <p className="mt-1 text-sm text-muted-foreground">Este número gobierna el avance público. No puede ser menor que los votos ya validados o en revisión.</p>
      <form action={configureElectionExpectedTotal} className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
        <input type="hidden" name="election_id" value={id}/>
        <Input name="total_expected_votes" type="number" min={1} max={100000000} defaultValue={expected || ""} placeholder="Total esperado"/>
        <Input name="reason" placeholder="Razón u observación del cambio"/>
        <SubmitButton pendingLabel="Guardando…" confirmMessage={expected?"Cambiar el total esperado modifica porcentajes y avance. ¿Continuar?":undefined}>{expected?"Actualizar total":"Configurar total"}</SubmitButton>
      </form>
    </section>
    <section className="mb-5 rounded-xl border bg-white p-5">
      <h2 className="font-semibold text-[#153553]">Porcentajes internos por tarjeta</h2>
      <div className="mt-4 grid gap-4">{totalRows.map((row)=><div key={row.option_id}>
        <div className="mb-1 flex justify-between gap-3 text-sm"><span className="font-medium">{row.card_label} · {row.candidate_name}</span><span>{formatPercent(expected?Number(row.total_valid)/expected*100:0)} · {Number(row.total_valid).toLocaleString("es-CO")} votos</span></div>
        <div className="h-3 overflow-hidden rounded bg-slate-100"><div className="h-full bg-[#153b5c]" style={{width:`${Math.max(2,Number(row.total_valid)/max*100)}%`}}/></div>
        <p className="mt-1 text-xs text-muted-foreground">{Number(row.admin_valid).toLocaleString("es-CO")} conteo general · {Number(row.online_valid).toLocaleString("es-CO")} online · {Number(row.manual_valid).toLocaleString("es-CO")} manual/offline</p>
        {election.winner_option_id===row.option_id&&election.winner_published_at&&<Badge className="mt-2 bg-emerald-700">Ganador oficial</Badge>}
      </div>)}</div>
    </section>
    <section className="mb-5 rounded-xl border bg-white p-5">
      <h2 className="font-semibold text-[#153553]">Agregar votos</h2>
      <p className="mt-1 text-sm text-muted-foreground">Registre votos por tarjeta electoral. Los lotes enviados pasan por revisión y no se publican automáticamente.</p>
      {expected>0?<div className="mt-4"><ElectionCountEntryForm electionId={id} expected={expected} counted={totalValid} inReview={inReview} options={optionRows} defaults={returned[0]??null}/></div>:<p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Configure primero el total esperado de votos.</p>}
    </section>
    <section className="mb-5 rounded-xl border bg-white p-5">
      <h2 className="font-semibold text-[#153553]">Votos en revisión</h2>
      <p className="mt-1 text-sm text-muted-foreground">Validar suma los votos al conteo; devolver o rechazar exige una razón y queda auditado.</p>
      <div className="mt-4 grid gap-3">{batchRows.filter((batch)=>batch.status==="submitted").map((batch)=><article key={batch.id} className="rounded-xl border bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[#153553]">Lote enviado a revisión</p><p className="text-xs text-muted-foreground">{formatDate(batch.submitted_at??batch.created_at)} · {sumBatch(batch).toLocaleString("es-CO")} votos</p></div><Badge variant="outline">En revisión</Badge></div>
        <BatchSummary batch={batch} options={optionRows}/>
        <form action={reviewElectionCountBatch} className="mt-3 grid gap-2">
          <input type="hidden" name="election_id" value={id}/><input type="hidden" name="batch_id" value={batch.id}/>
          <Textarea name="note" placeholder="Nota de revisión. Obligatoria para devolver o rechazar."/>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="status" value="validated" pendingLabel="Validando…" confirmMessage="Este lote contará como validado. ¿Continuar?">Validar lote</SubmitButton>
            <SubmitButton name="status" value="returned" variant="outline" pendingLabel="Devolviendo…" confirmMessage="Esta acción devolverá el lote para corrección con la nota indicada. ¿Continuar?">Devolver</SubmitButton>
            <SubmitButton name="status" value="rejected" variant="destructive" pendingLabel="Rechazando…" confirmMessage="Esta acción rechazará el lote y dejará auditoría. ¿Continuar?">Rechazar</SubmitButton>
          </div>
        </form>
      </article>)}{!batchRows.some((batch)=>batch.status==="submitted")&&<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No hay lotes pendientes de revisión.</p>}</div>
    </section>
    <section className="mb-5 rounded-xl border bg-white p-5">
      <h2 className="font-semibold text-[#153553]">Publicación y cierre</h2>
      <p className="mt-1 text-sm text-muted-foreground">El público ve porcentajes de la última actualización publicada. No se publican conteos brutos ni datos internos.</p>
      <div className="mt-4 rounded-xl border bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#153553]">Previsualización de próxima actualización</p>
            <p className="mt-1 text-xs text-muted-foreground">Se calculará únicamente con votos validados. Borradores y lotes en revisión quedan fuera.</p>
          </div>
          <Badge variant={hasValidatedUnpublished ? "default" : "outline"}>{hasValidatedUnpublished ? "Hay cambios por publicar" : "Sin cambios validados nuevos"}</Badge>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {totalRows.map((row)=><div key={`preview-${row.option_id}`} className="rounded border bg-white p-3 text-sm"><p className="text-xs font-semibold uppercase text-muted-foreground">{row.card_label}</p><p className="mt-1 break-words font-medium">{row.candidate_name}</p><p className="mt-2 text-lg font-bold text-[#153553]">{formatPercent(expected?Number(row.total_valid)/expected*100:0)}</p></div>)}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Avance previo publicado: {formatPercent(latestProgress)} · Próximo avance validado: {formatPercent(progress)}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><form action={createElectionUpdateSnapshot}><input type="hidden" name="election_id" value={id}/><input type="hidden" name="snapshot_type" value="preliminary"/><SubmitButton pendingLabel="Publicando…" confirmMessage="Publicará una actualización con votos validados. No incluirá borradores ni lotes en revisión. ¿Continuar?">Publicar actualización</SubmitButton></form><PublishButton id={id} kind="final" label="Publicar resultados definitivos"/><form action={publishElectionResults} className="flex flex-wrap gap-2"><input type="hidden" name="election_id" value={id}/><input type="hidden" name="kind" value="winner"/><select name="winner_option_id" className="h-9 rounded-md border px-3 text-sm">{optionRows.map((option)=><option key={option.id} value={option.id}>{option.candidate_name}</option>)}</select><SubmitButton pendingLabel="Declarando…" confirmMessage="Esta acción declarará el ganador oficial seleccionado. No se realiza automáticamente. ¿Continuar?">Declarar ganador oficial</SubmitButton></form></div>
    </section>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="font-semibold text-[#153553]">Historial de actualizaciones públicas</h2>
      <div className="mt-4 grid gap-3">{updateRows.map((item)=><article key={item.id} className="rounded border bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-3"><p className="font-semibold">Actualización {item.update_number}</p><p className="text-sm text-muted-foreground">{formatDate(item.updated_at)}</p></div><p className="mt-1 text-sm text-muted-foreground">{item.snapshot_type==="final"?"Resultados definitivos":item.snapshot_type==="winner"?"Declaración de ganador":"Resultados preliminares"} · avance {formatPercent(Number(item.progress_percentage))}</p>{item.note&&<p className="mt-2 text-sm">{item.note}</p>}</article>)}{!updateRows.length&&<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Aún no hay actualizaciones publicadas.</p>}</div>
    </section>
  </>;
}

function PublishButton({id,kind,label}:{id:string;kind:"preliminary"|"final";label:string}){return <form action={publishElectionResults}><input type="hidden" name="election_id" value={id}/><input type="hidden" name="kind" value={kind}/><SubmitButton variant="outline" pendingLabel="Publicando…" confirmMessage={kind==="final"?"Esta acción publicará resultados definitivos con datos validados. ¿Continuar?":"Esta acción publicará resultados preliminares con datos validados. ¿Continuar?"}>{label}</SubmitButton></form>;}
function Info({title,detail}:{title:string;detail:string}){return <div className="app-card-enter rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#b38a3c]/50 hover:shadow-md"><p className="font-semibold text-[#153553]">{title}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div>;}
function BatchSummary({batch,options}:{batch:BatchRow;options:OptionRow[]}){return <div className="mt-3 grid gap-1 text-xs text-muted-foreground">{options.map((option)=><p key={option.id}>{option.candidate_name}: {Number(batch.option_counts?.[option.id]??0).toLocaleString("es-CO")}</p>)}<p>Anulados: {Number(batch.annulled_votes??0).toLocaleString("es-CO")} · Rechazados/no válidos: {Number(batch.rejected_votes??0).toLocaleString("es-CO")}</p>{batch.note&&<p>Nota: {batch.note}</p>}</div>;}
function sumCounts(counts:Record<string,number>|null|undefined){return Object.values(counts??{}).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0);}
function sumBatch(batch:BatchRow){return sumCounts(batch.option_counts)+Number(batch.annulled_votes??0)+Number(batch.rejected_votes??0);}
function sumBatches(batches:BatchRow[]){return batches.reduce((sum,batch)=>sum+sumBatch(batch),0);}
function formatPercent(value:number){return `${Math.min(100,Math.max(0,value)).toFixed(2).replace(/\.00$/,"")}%`;}
function formatDate(value:string){return new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}
