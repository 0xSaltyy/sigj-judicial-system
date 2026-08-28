import Link from "next/link";
import { ArrowRight, Calendar, Megaphone } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

export const metadata = { title: "Comunicados" };

export default async function NoticesPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("public_notices").select("id,title,slug,category,issuing_entity,content_markdown,published_at").eq("status", "Publicado").is("archived_at", null).order("published_at", { ascending: false }).limit(50) : { data: null };
  const notices = data ?? [];
  return <><PageHero title="Comunicados institucionales" description="Avisos, novedades y comunicaciones emitidas por las dependencias del Departamento." /><div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16"><div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground"><Megaphone className="size-4" /> {notices.length} publicaciones vigentes</div><div className="divide-y border bg-white">{notices.length === 0 ? <Empty text="No hay comunicados publicados por el momento." /> : notices.map((item) => <article key={item.slug} className="group p-6 transition hover:bg-[#edf5fb]"><div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline" className="rounded-none border-[#b21b1b] bg-white text-[#b21b1b]">{item.category}</Badge><time className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="size-3.5" />{formatDate(item.published_at)}</time></div><h2 className="mt-5 font-serif text-2xl font-semibold leading-8 text-[#143654]">{item.title}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{excerpt(item.content_markdown)}</p><div className="mt-5"><p className="text-xs text-slate-500">{item.issuing_entity}</p><Link href={`/comunicados/${item.slug}`} className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#005ea8]">Leer comunicado <ArrowRight className="size-4 transition group-hover:translate-x-1" /></Link></div></article>)}</div></div></>;
}

function excerpt(value: string) { return value.replace(/[#*_`>-]/g, "").replace(/\s+/g, " ").trim().slice(0, 180) || "Comunicación disponible para consulta."; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-56 place-items-center p-8 text-center text-sm text-slate-600">{text}</div>; }
