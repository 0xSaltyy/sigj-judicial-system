import { Download, FileText } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { CaseStatusBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

export const metadata = { title: "Court notices" };
type StateRow = { id: string; state_number: string; state_date: string; status: string; dependencies: { name: string } | { name: string }[] | null };

export default async function StatesPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("judicial_states").select("id,state_number,state_date,status,dependencies(name)").eq("status", "Publicado").is("archived_at", null).order("state_date", { ascending: false }).limit(50) : { data: null };
  const states = (data ?? []) as StateRow[];
  return <><PageHero title="Court notices" description="Consulte publicaciones públicas de docket y notices emitidos por componentes autorizados." /><div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16"><div className="overflow-hidden rounded-lg border bg-white"><div className="border-b bg-slate-50 px-5 py-4 text-sm font-semibold text-[#153553]">Publicaciones recientes</div><div className="divide-y">{states.length === 0 ? <Empty text="No hay court notices publicados." /> : states.map((item) => <article key={item.id} className="flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center"><div className="flex gap-4"><div className="grid size-11 shrink-0 place-items-center rounded bg-[#edf2f6] text-[#183d61]"><FileText className="size-5" /></div><div><div className="flex flex-wrap items-center gap-3"><h2 className="mono-number text-sm font-semibold text-[#153553]">{item.state_number}</h2><CaseStatusBadge status={item.status} /></div><p className="mt-1.5 text-sm text-muted-foreground">{Array.isArray(item.dependencies) ? item.dependencies[0]?.name : item.dependencies?.name} · {formatDate(item.state_date)}</p></div></div><Button variant="outline" size="sm" className="gap-2"><Download className="size-4" /> Vista imprimible</Button></article>)}</div></div></div></>;
}

function Empty({ text }: { text: string }) { return <div className="grid min-h-48 place-items-center p-8 text-center text-sm text-slate-600">{text}</div>; }
