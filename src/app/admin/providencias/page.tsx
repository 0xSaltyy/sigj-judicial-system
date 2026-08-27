import Link from "next/link";
import { Eye, FileSignature, Plus } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseStatusBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

type ProceedingRow = { id: string; providence_number: string; title: string; type: string; chamber: string; status: string; created_at: string; archived_at: string | null; cases: { case_number: string | null; internal_number: string } | { case_number: string | null; internal_number: string }[] | null };

export default async function AdminProceedingsPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("proceedings").select("id,providence_number,title,type,chamber,status,created_at,archived_at,cases(case_number,internal_number)").order("created_at", { ascending: false }).limit(50) : { data: null };
  const rows = (data ?? []) as ProceedingRow[];
  return <><AdminPageHeader title="Providencias" description="Redacción, revisión, firma, publicación, archivo y eliminación de decisiones." action={<Button asChild className="gap-2 bg-[#153b5c]"><Link href="/admin/providencias/nueva"><Plus className="size-4" /> Nueva providencia</Link></Button>} /><div className="rounded-lg border bg-white"><div className="border-b p-4"><Input placeholder="Buscar por número, número de caso o título…" className="max-w-xl" /></div>{rows.length === 0 ? <EmptyState title="No hay providencias" description="Las providencias creadas dentro de expedientes aparecerán aquí." icon={<FileSignature className="size-6" />} /> : <Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Número</TableHead><TableHead>Tipo / título</TableHead><TableHead>Número de caso</TableHead><TableHead>Sala</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => { const relatedCase = Array.isArray(item.cases) ? item.cases[0] : item.cases; return <TableRow key={item.id}><TableCell className="mono-number text-xs font-semibold">{item.providence_number}</TableCell><TableCell><p className="text-sm font-semibold text-[#153553]">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.type}</p></TableCell><TableCell className="mono-number text-xs">{relatedCase?.case_number || relatedCase?.internal_number}</TableCell><TableCell className="text-xs">{item.chamber}</TableCell><TableCell className="text-xs">{formatDate(item.created_at)}</TableCell><TableCell><CaseStatusBadge status={item.status} /></TableCell><TableCell><div className="flex flex-wrap gap-2"><Button asChild variant="ghost" size="icon"><Link href={`/providencias/${item.id}`}><Eye className="size-4" /></Link></Button><LifecycleActions resource="proceedings" id={item.id} archived={Boolean(item.archived_at)} compact /></div></TableCell></TableRow>; })}</TableBody></Table>}</div></>;
}
