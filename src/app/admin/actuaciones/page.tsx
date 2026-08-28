import { Activity, Filter, Plus } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/display";

export const metadata = { title: "Docket y eventos" };
type ActionRow = { id: string; action_type: string; title: string; description: string | null; visibility: string; action_date: string; archived_at: string | null; cases: { case_number: string | null; internal_number: string } | { case_number: string | null; internal_number: string }[] | null };

export default async function ActionsPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("case_actions").select("id,action_type,title,description,visibility,action_date,archived_at,cases(case_number,internal_number)").order("action_date", { ascending: false }).limit(50) : { data: null };
  const rows = (data ?? []) as ActionRow[];
  return <><AdminPageHeader title="Docket y eventos internos" description="Court docket entries e internal DOJ events se mantienen separados. Esta vista muestra el registro cronológico heredado y los eventos migrados." action={<Button className="gap-2 bg-[#153b5c]"><Plus className="size-4" /> Nuevo evento</Button>} /><div className="rounded-lg border bg-white"><div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_auto]"><Input placeholder="Buscar evento, usuario, Case Number o Docket Number…" /><Button variant="outline" className="gap-2"><Filter className="size-4" /> Filtros</Button></div>{rows.length === 0 ? <EmptyState title="No hay eventos registrados" description="Los docket entries y eventos internos aparecerán aquí cuando existan registros." icon={<Activity className="size-6" />} /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Fecha</TableHead><TableHead>Tipo y descripción</TableHead><TableHead>Case Number</TableHead><TableHead>Visibilidad</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => { const relatedCase = Array.isArray(item.cases) ? item.cases[0] : item.cases; return <TableRow key={item.id}><TableCell className="whitespace-nowrap text-xs">{formatDateTime(item.action_date)}</TableCell><TableCell><p className="text-sm font-semibold text-[#153553]">{item.action_type}</p><p className="mt-1 max-w-md text-xs text-muted-foreground">{item.description || item.title}</p></TableCell><TableCell className="mono-number text-xs">{relatedCase?.case_number || relatedCase?.internal_number}</TableCell><TableCell><Badge variant="outline" className={item.visibility === "public" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100"}>{item.visibility}</Badge></TableCell><TableCell><LifecycleActions resource="case_actions" id={item.id} archived={Boolean(item.archived_at)} compact /></TableCell></TableRow>; })}</TableBody></Table></div>}</div></>;
}
