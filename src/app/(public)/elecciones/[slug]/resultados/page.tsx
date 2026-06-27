import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ELECTION_STATUS_LABELS, statusLabel } from "@/lib/elections";

type TotalRow={option_id:string;candidate_name:string;online_valid:number|string;manual_valid:number|string;total_valid:number|string};

export default async function PublicElectionResults({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;const supabase=await createClient();if(!supabase)notFound();
  const {data:election}=await supabase.from("public_elections").select("id,title,status").eq("slug",slug).maybeSingle();if(!election)notFound();
  const {data:totals}=await supabase.rpc("election_public_totals",{p_election_id:election.id});
  const totalRows=(totals??[]) as TotalRow[];const max=Math.max(1,...totalRows.map((t)=>Number(t.total_valid)));
  const visible=["preliminary_results","definitively_closed","final_results_published"].includes(election.status);
  return <main className="mx-auto max-w-5xl px-4 py-10"><Badge variant="outline">{statusLabel(ELECTION_STATUS_LABELS,election.status)}</Badge><h1 className="mt-3 break-words text-3xl font-bold text-[#153553]">{election.title}</h1><p className="mt-2 text-sm text-muted-foreground">{election.status==="final_results_published"?"Resultados definitivos publicados":"Resultados preliminares o en escrutinio"}</p>{!visible?<p className="mt-6 rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">Los resultados aún no han sido publicados por personal autorizado.</p>:<section className="mt-6 rounded-xl border bg-white p-5"><div className="grid gap-5">{totalRows.map((t)=><div key={t.option_id}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="font-semibold">{t.candidate_name}</span><span>{t.total_valid} votos válidos</span></div><div className="h-3 overflow-hidden rounded bg-slate-100"><div className="h-full bg-[#153b5c]" style={{width:`${Math.max(2,Number(t.total_valid)/max*100)}%`}}/></div><p className="mt-1 text-xs text-muted-foreground">Online válidos: {t.online_valid} · Manuales válidos: {t.manual_valid}</p></div>)}</div><p className="mt-5 text-xs text-muted-foreground">Los resultados separan votos online y manuales. Ningún ganador es oficial hasta declaración humana autorizada.</p></section>}</main>;
}
