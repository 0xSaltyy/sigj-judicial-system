import { Download, History } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/display";

export default async function AuditPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("audit_logs").select("id,created_at,user_id,action,table_name,description,ip_address").order("created_at", { ascending: false }).limit(100) : { data: null };
  const logs = data ?? [];
  return <><AdminPageHeader title="Auditoría del sistema" description="Trazabilidad de acciones sensibles. Acceso exclusivo para perfiles autorizados." action={<Button variant="outline" className="gap-2"><Download className="size-4" /> Exportar</Button>} /><div className="overflow-hidden rounded-lg border bg-white">{logs.length === 0 ? <EmptyState title="No hay eventos de auditoría visibles" description="Las acciones sensibles quedarán registradas automáticamente." icon={<History className="size-6" />} /> : <Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Fecha y hora</TableHead><TableHead>Usuario</TableHead><TableHead>Acción</TableHead><TableHead>Tabla</TableHead><TableHead>Descripción</TableHead><TableHead>IP</TableHead></TableRow></TableHeader><TableBody>{logs.map((item) => <TableRow key={item.id}><TableCell className="mono-number whitespace-nowrap text-xs">{formatDateTime(item.created_at)}</TableCell><TableCell className="mono-number text-xs">{item.user_id || "Sistema"}</TableCell><TableCell className="mono-number text-xs font-semibold text-[#8b6829]">{item.action}</TableCell><TableCell className="mono-number text-xs">{item.table_name}</TableCell><TableCell className="text-xs">{item.description}</TableCell><TableCell className="mono-number text-xs text-muted-foreground">{item.ip_address || "No registrada"}</TableCell></TableRow>)}</TableBody></Table>}<div className="flex items-center gap-2 border-t bg-slate-50 p-4 text-xs text-muted-foreground"><History className="size-4" /> Los registros de auditoría son de solo lectura.</div></div></>;
}
