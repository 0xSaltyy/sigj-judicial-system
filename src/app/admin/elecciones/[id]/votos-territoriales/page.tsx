import Link from "next/link";
import { notFound } from "next/navigation";
import { configureElectionCityTotal } from "@/app/actions/elections";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { TerritorialVoteEntryForm } from "@/components/territorial-vote-entry-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { VALLE_ELECTION_CITIES } from "@/lib/valle-del-cauca";

type OptionRow = { id: string; candidate_name: string; display_order: number };
type ZoneRow = { id: string; zone_name: string; expected_votes: number; option_counts: Record<string, number> | null; annulled_votes: number; rejected_votes: number; counted_percentage: number | string; validation_status?: string | null; published_at: string | null };
type BatchRow = { id: string; city: string; status: string; option_counts: Record<string, number> | null; annulled_votes: number; rejected_votes: number; note: string | null; created_at: string; submitted_at: string | null };
type HistoryRow = { action: string; actor_name: string; created_at: string; note: string | null };

export default async function TerritorialVotesPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;success?:string}>}) {
  const [{id},query,{supabase}]=await Promise.all([params,searchParams,requirePermission(PERMISSIONS.electionsMapView)]);
  const [{data:election},{data:options},{data:zones},{data:batches}]=await Promise.all([
    supabase.from("elections").select("id,title,territory").eq("id",id).maybeSingle(),
    supabase.from("election_options").select("id,candidate_name,display_order").eq("election_id",id).eq("active",true).order("display_order"),
    supabase.from("election_territorial_results").select("id,zone_name,expected_votes,option_counts,annulled_votes,rejected_votes,counted_percentage,validation_status,published_at").eq("election_id",id).in("zone_name",[...VALLE_ELECTION_CITIES]),
    supabase.from("election_territorial_city_batches").select("id,city,status,option_counts,annulled_votes,rejected_votes,note,created_at,submitted_at").eq("election_id",id).order("created_at",{ascending:false}),
  ]);
  if(!election)notFound();
  const zoneByCity=new Map((zones??[] as ZoneRow[]).map((zone)=>[zone.zone_name,zone]));
  const batchesByCity=new Map<string,BatchRow[]>();
  for(const batch of (batches??[]) as BatchRow[]) batchesByCity.set(batch.city,[...(batchesByCity.get(batch.city)??[]),batch]);
  const histories=await Promise.all(VALLE_ELECTION_CITIES.map(async(city)=>{const {data}=await supabase.rpc("get_election_city_history",{p_election_id:id,p_city:city});return [city,(data??[]) as HistoryRow[]] as const;}));
  const historyByCity=new Map(histories);
  const optionRows=(options??[]) as OptionRow[];
  const alerts=VALLE_ELECTION_CITIES.flatMap((city)=>cityAlerts(city,zoneByCity.get(city),batchesByCity.get(city)??[]));

  return <><AdminPageHeader title="Votos territoriales" description={`${election.title} · ${election.territory}`} action={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}`}>Volver</Link></Button><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}/escrutinio`}>Revisión</Link></Button><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}/resultados`}>Resultados</Link></Button></div>}/><ActionMessage error={query.error} success={query.success}/>
    <section className="mb-5 rounded-xl border bg-white p-5">
      <h2 className="font-semibold text-[#153553]">Flujo simple</h2>
      <p className="mt-1 text-sm text-muted-foreground">Primero configure el total esperado de cada ciudad. Luego agregue votos nuevos. Los votos pasan a revisión y solo se publican cuando una autoridad publica una actualización.</p>
      <div className="mt-4 grid gap-2 md:grid-cols-4">{["Configurar total","Agregar votos nuevos","Enviar a revisión","Publicar actualización"].map((label,index)=><div key={label} className="rounded-lg border bg-slate-50 p-3 text-xs"><span className="font-bold text-[#153553]">{index+1}. {label}</span></div>)}</div>
    </section>
    {Boolean(alerts.length)&&<section className="mb-5 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{alerts.map((alert)=><p key={alert}>{alert}</p>)}</section>}
    <section className="grid gap-5 xl:grid-cols-2">
      {VALLE_ELECTION_CITIES.map((city)=>{
        const zone=zoneByCity.get(city);
        const cityBatches=batchesByCity.get(city)??[];
        const expected=Number(zone?.expected_votes??0);
        const validated=sumZone(zone);
        const inReview=sumBatches(cityBatches.filter((batch)=>batch.status==="submitted"));
        const remaining=Math.max(0,expected-validated-inReview);
        const progress=expected>0?(validated/expected)*100:0;
        const returned=cityBatches.find((batch)=>batch.status==="returned");
        const status=cityStatus(expected,validated,inReview,Boolean(returned),Boolean(zone?.published_at));
        return <article key={city} className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-xl font-semibold text-[#153553]">{city}</h2><p className="text-xs text-muted-foreground">Ciudad territorial configurada</p></div>
            <Badge variant="outline">{status}</Badge>
          </div>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Total esperado" value={expected?expected.toLocaleString("es-CO"):"Sin configurar"}/>
            <Info label="Validado" value={expected?`${percent(validated,expected)} · ${validated.toLocaleString("es-CO")} votos`:"—"}/>
            <Info label="En revisión" value={expected?`${percent(inReview,expected)} · ${inReview.toLocaleString("es-CO")} votos`:"—"}/>
            <Info label="Restante" value={expected?`${percent(remaining,expected)} · ${remaining.toLocaleString("es-CO")} votos`:"—"}/>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#153553]" style={{width:`${Math.min(100,Math.max(0,progress))}%`}}/></div>
          <details className="mt-4 rounded-xl border bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-[#153553]">Configurar total</summary>
            <form action={configureElectionCityTotal} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="election_id" value={id}/><input type="hidden" name="city" value={city}/>
              <Input name="expected_votes" type="number" min={1} defaultValue={expected||""} placeholder="Total esperado de votos" className="max-w-48"/>
              <SubmitButton pendingLabel="Configurando…" confirmMessage={expected?"Cambiar el total esperado modificará los porcentajes y el avance. ¿Continuar?":undefined}>{expected?"Cambiar total esperado":"Configurar total"}</SubmitButton>
            </form>
          </details>
          {expected>0?<TerritorialVoteEntryForm electionId={id} city={city} expected={expected} validated={validated} inReview={inReview} options={optionRows} correctionOf={returned?.id??null} defaults={returned?{option_counts:returned.option_counts??{},annulled_votes:returned.annulled_votes,rejected_votes:returned.rejected_votes}:null}/>:<p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Configure primero el total esperado de esta ciudad para poder agregar votos.</p>}
          <details className="mt-4 rounded-xl border bg-white p-3 text-xs">
            <summary className="cursor-pointer font-semibold text-[#153553]">Ver historial</summary>
            <div className="mt-3 grid gap-2">{(historyByCity.get(city)??[]).map((item)=><p key={`${item.action}-${item.created_at}`} className="rounded border bg-slate-50 p-2"><span className="font-semibold">{historyLabel(item.action)}</span> · {item.actor_name} · {formatDate(item.created_at)}{item.note?` · ${item.note}`:""}</p>)}{!(historyByCity.get(city)??[]).length&&<p className="text-muted-foreground">Sin historial todavía.</p>}</div>
          </details>
        </article>;
      })}
    </section>
  </>;
}

function Info({label,value}:{label:string;value:string}){return <div className="rounded border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold text-[#153553]">{value}</p></div>;}
function sumCounts(counts:Record<string,number>|null|undefined){return Object.values(counts??{}).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0);}
function sumZone(zone:ZoneRow|undefined){return zone?sumCounts(zone.option_counts)+Number(zone.annulled_votes??0)+Number(zone.rejected_votes??0):0;}
function sumBatches(batches:BatchRow[]){return batches.reduce((sum,batch)=>sum+sumCounts(batch.option_counts)+Number(batch.annulled_votes??0)+Number(batch.rejected_votes??0),0);}
function percent(value:number,total:number){return `${Math.min(100,Math.max(0,(value/Math.max(1,total))*100)).toFixed(2).replace(/\.00$/,"")}%`;}
function cityStatus(expected:number,validated:number,inReview:number,returned:boolean,published:boolean){if(!expected)return "Sin configurar";if(returned)return "Devuelto";if(inReview>0)return "En revisión";if(validated>=expected)return published?"Publicado":"Completo";return "En progreso";}
function cityAlerts(city:string,zone:ZoneRow|undefined,batches:BatchRow[]){const alerts:string[]=[];if(!zone?.expected_votes)alerts.push(`Falta configurar el total esperado de ${city}.`);if(batches.some((batch)=>batch.status==="draft"))alerts.push(`${city} tiene votos guardados sin enviar.`);if(batches.some((batch)=>batch.status==="submitted"))alerts.push(`${city} tiene votos en revisión.`);if(batches.some((batch)=>batch.status==="returned"))alerts.push(`${city} fue devuelta para corrección.`);if(zone?.counted_percentage&&Number(zone.counted_percentage)>=100&&!zone.published_at)alerts.push(`${city} llegó al 100%; revise el acta y publique actualización.`);if(zone?.validation_status==="validated")alerts.push(`${city} tiene votos validados sin publicar.`);return alerts;}
function historyLabel(value:string){return ({ELECTION_CITY_TOTAL_CONFIGURED:"Total esperado configurado",ELECTION_CITY_TOTAL_CHANGED:"Total esperado cambiado",ELECTION_CITY_VOTES_DRAFT_SAVED:"Borrador guardado",ELECTION_CITY_VOTES_SENT_TO_REVIEW:"Enviado a revisión",ELECTION_CITY_BATCH_VALIDATED:"Validado",ELECTION_CITY_BATCH_RETURNED:"Devuelto para corrección",ELECTION_CITY_BATCH_REJECTED:"Rechazado",ELECTION_RESULTS_UPDATED:"Publicado en actualización"} as Record<string,string>)[value]??value;}
function formatDate(value:string){return new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}
