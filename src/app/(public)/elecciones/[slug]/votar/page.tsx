import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ElectionBallot } from "@/components/election-ballot";

export default async function VotePage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{error?:string}>}){
  const [{slug},query]=await Promise.all([params,searchParams]);const supabase=await createClient();if(!supabase)notFound();
  const {data:election}=await supabase.from("public_elections").select("*").eq("slug",slug).maybeSingle();if(!election)notFound();
  const {data:options}=await supabase.from("public_election_options").select("id,candidate_name,party_name,is_blank_vote,display_order").eq("election_id",election.id).order("display_order");
  return <main className="mx-auto max-w-7xl px-4 py-8"><div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#9a752f]">Tarjeta electoral</p><h1 className="mt-2 break-words text-3xl font-bold text-[#153553]">{election.title}</h1><p className="mt-2 text-sm text-muted-foreground">{election.instructions||"Seleccione una opción y confirme su voto."}</p>{query.error&&<p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{query.error}</p>}</div>{["open","reopened"].includes(election.status)?<ElectionBallot electionId={election.id} slug={slug} ballotImage={election.ballot_image_path} zones={election.ballot_zones} options={options??[]}/>:<p className="rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">La elección no está abierta para votación.</p>}</main>;
}
