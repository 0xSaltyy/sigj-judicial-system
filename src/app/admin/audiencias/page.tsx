import { CalendarDays, CalendarPlus, MoreHorizontal } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { Button } from "@/components/ui/button";
import { CaseStatusBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/display";

type HearingRow = { id: string; title: string; hearing_type: string; scheduled_at: string; room: string; virtual_link: string | null; status: string; is_public: boolean; archived_at: string | null; cases: { internal_number: string; title: string } | { internal_number: string; title: string }[] | null };

export default async function AdminHearingsPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("hearings").select("id,title,hearing_type,scheduled_at,room,virtual_link,status,is_public,archived_at,cases(internal_number,title)").order("scheduled_at", { ascending: true }).limit(50) : { data: null };
  const rows = (data ?? []) as HearingRow[];
  return <><AdminPageHeader title="Hearing calendar" description="Programación y gestión de hearings físicos, remotos o híbridos." action={<Button className="gap-2 bg-[#153b5c]"><CalendarPlus className="size-4" /> Programar hearing</Button>} />{rows.length === 0 ? <EmptyState title="No hay hearings programados" description="Los hearings creados para Federal Cases aparecerán en esta agenda." icon={<CalendarDays className="size-6" />} /> : <div className="grid gap-4 lg:grid-cols-2">{rows.map((item) => <article key={item.id} className="rounded-lg border bg-white p-5"><div className="flex items-start justify-between"><div className="flex gap-4"><div className="rounded bg-[#153b5c] px-3 py-2 text-center text-white"><p className="mono-number text-xs font-semibold">{formatDateTime(item.scheduled_at)}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-[#9a752f]">{item.hearing_type}</p><h2 className="mt-1 text-base font-semibold text-[#153553]">{item.title}</h2><p className="mono-number mt-1 text-xs text-muted-foreground">{Array.isArray(item.cases) ? item.cases[0]?.internal_number : item.cases?.internal_number}</p></div></div><Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-xs text-muted-foreground">{item.room} · {item.is_public ? "Public" : "Restricted"}</p><CaseStatusBadge status={item.status} /></div><div className="mt-4 border-t pt-4"><LifecycleActions resource="hearings" id={item.id} archived={Boolean(item.archived_at)} compact /></div></article>)}</div>}</>;
}
