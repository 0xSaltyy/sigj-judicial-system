import { History } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/authorization";

function summarize(value: unknown) {
  if (!value || typeof value !== "object") return "—";
  const safe = Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !["email", "id", "created_at", "updated_at"].includes(key)));
  return Object.keys(safe).length ? JSON.stringify(safe) : "—";
}

export default async function AuditPage() {
  const { supabase } = await requireOwner();
  const [{ data: logs, error }, { data: profiles }] = await Promise.all([
    supabase.from("audit_logs").select("id,user_id,target_user_id,action,table_name,description,old_values,new_values,created_at").order("created_at", { ascending: false }).limit(250),
    supabase.from("profiles").select("id,full_name,is_owner"),
  ]);
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.is_owner ? "Propietario del Sistema" : profile.full_name]));
  return <>
    <AdminPageHeader title="Auditoría del sistema" description="Registro privado e inmutable de acciones sensibles y cambios de usuarios. Acceso exclusivo del propietario." />
    {error && <p className="mb-5 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">No fue posible cargar la auditoría: {error.message}</p>}
    <div className="overflow-x-auto rounded-lg border bg-white"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Fecha</TableHead><TableHead>Actor / objetivo</TableHead><TableHead>Acción</TableHead><TableHead>Descripción</TableHead><TableHead>Valor anterior</TableHead><TableHead>Valor nuevo</TableHead></TableRow></TableHeader><TableBody>{(logs ?? []).map((log) => <TableRow key={log.id}><TableCell className="mono-number whitespace-nowrap text-xs">{new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "medium" }).format(new Date(log.created_at))}</TableCell><TableCell className="min-w-44 text-xs"><p className="font-semibold">{log.user_id ? names.get(log.user_id) ?? "Cuenta del sistema" : "Proceso del sistema"}</p>{log.target_user_id && <p className="mt-1 text-muted-foreground">Objetivo: {names.get(log.target_user_id) ?? "Perfil interno"}</p>}</TableCell><TableCell><Badge variant="outline" className="mono-number text-[10px]">{log.action}</Badge><p className="mono-number mt-1 text-[10px] text-muted-foreground">{log.table_name}</p></TableCell><TableCell className="max-w-xs text-xs">{log.description}</TableCell><TableCell className="max-w-xs whitespace-normal break-words font-mono text-[10px] text-muted-foreground">{summarize(log.old_values)}</TableCell><TableCell className="max-w-xs whitespace-normal break-words font-mono text-[10px] text-muted-foreground">{summarize(log.new_values)}</TableCell></TableRow>)}</TableBody></Table>{!logs?.length && !error && <p className="p-8 text-center text-sm text-muted-foreground">No hay eventos registrados.</p>}<div className="flex items-center gap-2 border-t bg-slate-50 p-4 text-xs text-muted-foreground"><History className="size-4" /> Los registros no pueden editarse ni eliminarse desde la aplicación.</div></div>
  </>;
}
