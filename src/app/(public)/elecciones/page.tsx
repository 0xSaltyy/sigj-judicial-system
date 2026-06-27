import Link from "next/link";
import { Vote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ELECTION_STATUS_LABELS, statusLabel } from "@/lib/elections";

export default async function PublicElectionsPage(){
  const supabase=await createClient();const {data:elections}=supabase?await supabase.from("public_elections").select("*").order("opens_at",{ascending:false}):{data:[]};
  return <main className="mx-auto max-w-6xl px-4 py-10"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#9a752f]">Elecciones institucionales</p><h1 className="mt-2 text-3xl font-bold text-[#153553]">Votaciones disponibles</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Consulta elecciones públicas, participa cuando estén abiertas y revisa comprobantes sin exponer tu selección.</p></div><Button asChild variant="outline"><Link href="/elecciones/comprobante">Consultar comprobante</Link></Button></div><div className="grid gap-4 md:grid-cols-2">{elections?.map((e)=><article key={e.id} className="rounded-xl border bg-white p-5 shadow-sm"><Vote className="mb-3 size-6 text-[#9a752f]"/><h2 className="break-words font-semibold text-[#153553]">{e.title}</h2><p className="mt-1 text-sm text-muted-foreground">{e.office} · {e.territory} · {e.period}</p><Badge variant="outline" className="mt-3">{statusLabel(ELECTION_STATUS_LABELS,e.status)}</Badge><div className="mt-4 flex flex-wrap gap-2"><Button asChild size="sm"><Link href={`/elecciones/${e.slug}`}>Ver elección</Link></Button>{["open","reopened"].includes(e.status)&&<Button asChild size="sm" variant="outline"><Link href={`/elecciones/${e.slug}/votar`}>Votar</Link></Button>}<Button asChild size="sm" variant="outline"><Link href={`/elecciones/${e.slug}/resultados`}>Resultados</Link></Button></div></article>)}{!elections?.length&&<p className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground md:col-span-2">No hay elecciones públicas disponibles.</p>}</div></main>;
}
