import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { CaseStatusBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/display";

export const metadata = { title: "Audiencias públicas" };
type HearingRow = { id: string; title: string; hearing_type: string; scheduled_at: string; room: string; status: string; cases: { internal_number: string } | { internal_number: string }[] | null };

export default async function HearingsPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("hearings").select("id,title,hearing_type,scheduled_at,room,status,cases(internal_number)").eq("is_public", true).is("archived_at", null).order("scheduled_at", { ascending: true }).limit(50) : { data: null };
  const hearings = (data ?? []) as HearingRow[];
  return <><PageHero title="Agenda de audiencias públicas" description="Programación de sesiones públicas del Departamento." /><div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16"><div className="mb-7 flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4" /> Audiencias publicadas</div><div className="space-y-4">{hearings.length === 0 ? <Empty text="No hay audiencias públicas programadas." /> : hearings.map((item) => <article key={item.id} className="grid overflow-hidden border bg-white md:grid-cols-[180px_1fr_auto]"><div className="grid place-items-center bg-[#112f4e] p-5 text-center text-white"><div><p className="mono-number text-sm font-semibold text-white">{formatDateTime(item.scheduled_at)}</p></div></div><div className="p-5 sm:p-6"><div className="flex flex-wrap gap-2"><span className="text-xs font-semibold uppercase tracking-wider text-[#b21b1b]">{item.hearing_type}</span><span className="text-slate-300">·</span><span className="mono-number text-xs text-muted-foreground">{Array.isArray(item.cases) ? item.cases[0]?.internal_number : item.cases?.internal_number}</span></div><h2 className="mt-2 text-lg font-semibold text-[#153553]">{item.title}</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{item.room}</span><span className="flex items-center gap-1.5"><Clock3 className="size-3.5" />Hora del servidor</span></div></div><div className="flex items-center border-t p-5 md:border-l md:border-t-0"><CaseStatusBadge status={item.status} /></div></article>)}</div></div></>;
}

function Empty({ text }: { text: string }) { return <div className="grid min-h-56 place-items-center border border-dashed bg-white p-8 text-center text-sm text-slate-600">{text}</div>; }
