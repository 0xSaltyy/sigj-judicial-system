import Link from "next/link";
import { ArrowRight, BookOpen, Filter } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

export const metadata = { title: "Biblioteca de providencias" };
type ProceedingRow = { id: string; providence_number: string; title: string; type: string; chamber: string; created_at: string; cases: { internal_number: string } | { internal_number: string }[] | null };

export default async function ProceedingsPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("proceedings").select("id,providence_number,title,type,chamber,created_at,cases(internal_number)").eq("status", "Publicado").eq("visibility", "public").is("archived_at", null).order("created_at", { ascending: false }).limit(50) : { data: null };
  const proceedings = (data ?? []) as ProceedingRow[];
  return <><PageHero eyebrow="Relatoría" title="Biblioteca de providencias" description="Autos y sentencias publicados para consulta pública." /><div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16"><div className="mb-6 flex flex-col gap-3 border bg-white p-4 sm:flex-row"><Input placeholder="Buscar por radicado, título o ponente…" /><Button variant="outline" className="gap-2 rounded-none"><Filter className="size-4" /> Filtros</Button></div><div className="divide-y border bg-white">{proceedings.length === 0 ? <Empty text="No hay providencias públicas disponibles." /> : proceedings.map((item) => <article key={item.id} className="group flex flex-col gap-5 p-6 sm:flex-row"><div className="grid size-11 shrink-0 place-items-center bg-[#edf2f6] text-[#183d61]"><BookOpen className="size-5" /></div><div className="flex-1"><p className="text-[11px] font-semibold uppercase tracking-wider text-[#b21b1b]">{item.type} · {item.chamber}</p><h2 className="mt-2 text-lg font-semibold text-[#153553]">{item.title}</h2><p className="mono-number mt-2 text-xs text-muted-foreground">{item.providence_number} · {Array.isArray(item.cases) ? item.cases[0]?.internal_number : item.cases?.internal_number}</p><p className="mt-2 text-xs text-slate-500">{formatDate(item.created_at)}</p></div><Link href={`/providencias/${item.id}`} className="flex items-center gap-2 self-start text-sm font-semibold text-[#005ea8] sm:self-center">Consultar <ArrowRight className="size-4 transition group-hover:translate-x-1" /></Link></article>)}</div></div></>;
}

function Empty({ text }: { text: string }) { return <div className="grid min-h-56 place-items-center p-8 text-center text-sm text-slate-600">{text}</div>; }
