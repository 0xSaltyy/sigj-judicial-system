import { Megaphone, Plus } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseStatusBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

export default async function AdminNoticesPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("public_notices").select("id,title,slug,category,issuing_entity,published_at,status,archived_at").order("created_at", { ascending: false }).limit(50) : { data: null };
  const rows = data ?? [];
  return <><AdminPageHeader title="Comunicados" description="Gestión editorial de información institucional y avisos públicos." action={<Button className="gap-2 bg-[#153b5c]"><Plus className="size-4" /> Nuevo comunicado</Button>} /><div className="overflow-hidden rounded-lg border bg-white">{rows.length === 0 ? <EmptyState title="No hay comunicados" description="Los borradores y publicaciones aparecerán aquí." icon={<Megaphone className="size-6" />} /> : <Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Título</TableHead><TableHead>Categoría</TableHead><TableHead>Entidad emisora</TableHead><TableHead>Publicación</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => <TableRow key={item.id}><TableCell className="max-w-md"><p className="text-sm font-semibold text-[#153553]">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">/{item.slug}</p></TableCell><TableCell className="text-xs">{item.category}</TableCell><TableCell className="text-xs">{item.issuing_entity}</TableCell><TableCell className="text-xs">{formatDate(item.published_at)}</TableCell><TableCell><CaseStatusBadge status={item.status} /></TableCell><TableCell><LifecycleActions resource="public_notices" id={item.id} archived={Boolean(item.archived_at)} compact /></TableCell></TableRow>)}</TableBody></Table>}</div></>;
}
