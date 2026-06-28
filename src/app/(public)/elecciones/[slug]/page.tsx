import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ELECTION_STATUS_LABELS, statusLabel } from "@/lib/elections";

export default async function PublicElectionDetail({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{error?:string;success?:string}>}){
  const [{slug},query]=await Promise.all([params,searchParams]);const supabase=await createClient();if(!supabase)notFound();
  const {data:election}=await supabase.from("public_elections").select("*").eq("slug",slug).maybeSingle();if(!election)notFound();
  const {data:options}=await supabase.from("public_election_options").select("*").eq("election_id",election.id).order("display_order");
  return <main className="mx-auto max-w-6xl px-4 py-10"><div className="rounded-2xl border bg-white p-6 shadow-sm"><Badge variant="outline">{statusLabel(ELECTION_STATUS_LABELS,election.status)}</Badge><h1 className="mt-3 break-words text-3xl font-bold text-[#153553]">{election.title}</h1><p className="mt-2 text-muted-foreground">{election.office} · {election.territory} · {election.period} · {election.round_label}</p>{query.error&&<p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{query.error}</p>}<p className="mt-5 whitespace-pre-wrap text-sm">{election.description}</p><div className="mt-6 flex flex-wrap gap-2">{["open","reopened"].includes(election.status)?<Button asChild className="bg-[#153b5c]"><Link href={`/elecciones/${slug}/votar`}>Ir a votar</Link></Button>:<Button disabled>Votación no abierta</Button>}<Button asChild variant="outline"><Link href={`/elecciones/${slug}/resultados`}>Ver resultados</Link></Button><Button asChild variant="outline"><Link href={`/elecciones/${slug}/mapa`}>Mapa electoral</Link></Button><Button asChild variant="outline"><Link href={`/elecciones/${slug}/sala`}>Sala en vivo</Link></Button></div></div><section className="mt-6 grid gap-4 md:grid-cols-3">{options?.map((o)=><article key={o.id} className="min-w-0 overflow-hidden rounded-xl border bg-white p-4">{o.ballot_card_image_path?<Image src={o.ballot_card_image_path} alt={`Tarjeta de ${o.candidate_name}`} width={543} height={724} className="h-auto w-full rounded border object-contain"/>:<div className="grid aspect-[3/4] place-items-center rounded border border-dashed text-center text-sm text-muted-foreground">Imagen de tarjeta electoral no disponible.</div>}<h2 className="mt-3 break-words font-semibold text-[#153553]">{o.candidate_name}</h2><p className="break-words text-sm text-muted-foreground">{o.party_name||"Opción electoral"}</p></article>)}</section></main>;
}
