import { ClipboardList, FilePlus2, Printer } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { Button } from "@/components/ui/button";
import { CaseStatusBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

type StateRow = { id: string; state_number: string; state_date: string; status: string; archived_at: string | null; dependencies: { name: string } | { name: string }[] | null };

export default async function AdminStatesPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("judicial_states").select("id,state_number,state_date,status,archived_at,dependencies(name)").order("state_date", { ascending: false }).limit(50) : { data: null };
  const rows = (data ?? []) as StateRow[];
  return <><AdminPageHeader title="Court notices" description="Publicación de docket notices públicos por componente y fecha." action={<Button className="gap-2 bg-[#153b5c]"><FilePlus2 className="size-4" /> Crear notice</Button>} />{rows.length === 0 ? <EmptyState title="No hay court notices" description="Los notices publicados o en borrador aparecerán aquí." icon={<ClipboardList className="size-6" />} /> : <div className="space-y-3">{rows.map((item) => <article key={item.id} className="flex flex-col justify-between gap-4 rounded-lg border bg-white p-5 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-3"><p className="mono-number text-sm font-semibold text-[#153553]">{item.state_number}</p><CaseStatusBadge status={item.status} /></div><p className="mt-2 text-sm text-muted-foreground">{Array.isArray(item.dependencies) ? item.dependencies[0]?.name : item.dependencies?.name} · {formatDate(item.state_date)}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm">Gestionar entries</Button><Button variant="outline" size="icon"><Printer className="size-4" /></Button><LifecycleActions resource="judicial_states" id={item.id} archived={Boolean(item.archived_at)} compact /></div></article>)}</div>}</>;
}
