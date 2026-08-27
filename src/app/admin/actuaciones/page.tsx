import { Activity, Filter, Plus } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/display";

export const metadata = { title: "Actuaciones" };
type ActionRow = { id: string; action_type: string; title: string; description: string | null; visibility: string; action_date: string; archived_at: string | null; cases: { internal_number: string } | { internal_number: string }[] | null };

export default async function ActionsPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("case_actions").select("id,action_type,title,description,visibility,action_date,archived_at,cases(internal_number)").order("action_date", { ascending: false }).limit(50) : { data: null };
  const rows = (data ?? []) as ActionRow[];
  return <><AdminPageHeader title="Actuaciones procesales" description="Registro cronológico global de actuaciones judiciales y administrativas." action={<Button className="gap-2 bg-[#153b5c]"><Plus className="size-4" /> Nueva actuación</Button>} /><div className="rounded-lg border bg-white"><div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_auto]"><Input placeholder="Buscar actuación, usuario o radicado…" /><Button variant="outline" className="gap-2"><Filter className="size-4" /> Filtros</Button></div>{rows.length === 0 ? <EmptyState title="No hay actuaciones" description="Las actuaciones registradas en expedientes aparecerán aquí." icon={<Activity className="size-6" />} /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Fecha</TableHead><TableHead>Tipo y descripción</TableHead><TableHead>Expediente</TableHead><TableHead>Visibilidad</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => <TableRow key={item.id}><TableCell className="whitespace-nowrap text-xs">{formatDateTime(item.action_date)}</TableCell><TableCell><p className="text-sm font-semibold text-[#153553]">{item.action_type}</p><p className="mt-1 max-w-md text-xs text-muted-foreground">{item.description || item.title}</p></TableCell><TableCell className="mono-number text-xs">{Array.isArray(item.cases) ? item.cases[0]?.internal_number : item.cases?.internal_number}</TableCell><TableCell><Badge variant="outline" className={item.visibility === "public" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100"}>{item.visibility}</Badge></TableCell><TableCell><LifecycleActions resource="case_actions" id={item.id} archived={Boolean(item.archived_at)} compact /></TableCell></TableRow>)}</TableBody></Table></div>}</div></>;
}
