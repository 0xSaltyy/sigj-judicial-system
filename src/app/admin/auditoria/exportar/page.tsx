import { PrintDocumentShell } from "@/components/print-document-shell";
import { PrintOnLoad } from "@/components/print-on-load";
import { requireOwner } from "@/lib/auth/authorization";

export default async function AuditExportPage() {
  const { supabase } = await requireOwner();
  const { data: logs } = await supabase.from("audit_logs").select("id,action,table_name,description,created_at,user_id").order("created_at",{ascending:false}).limit(1000);
  await supabase.rpc("log_security_event", { p_action: "AUDIT_REPORT_EXPORTED", p_table: "audit_logs", p_record_id: null, p_description: "Informe privado de trazabilidad interna exportado", p_metadata: { rows: logs?.length ?? 0 } });
  return <PrintDocumentShell><PrintOnLoad /><article className="print-document judicial-document mx-auto max-w-[210mm] bg-white p-[18mm]"><header className="border-b-2 border-black pb-5 text-center"><p className="font-bold">SIGJ · PALACIO JUDICIAL</p><h1 className="mt-3 text-xl font-bold uppercase">Informe de trazabilidad interna</h1><p className="mt-2 text-xs">Documento privado de auditoría. No forma parte del expediente judicial formal.</p></header><table className="mt-8 w-full border-collapse text-[10px]"><thead><tr><th className="border p-2">Fecha</th><th className="border p-2">Acción</th><th className="border p-2">Recurso</th><th className="border p-2">Descripción</th></tr></thead><tbody>{(logs ?? []).map((log) => <tr key={log.id}><td className="border p-2">{new Intl.DateTimeFormat("es-CO",{dateStyle:"short",timeStyle:"medium"}).format(new Date(log.created_at))}</td><td className="border p-2">{log.action}</td><td className="border p-2">{log.table_name}</td><td className="border p-2">{log.description}</td></tr>)}</tbody></table></article></PrintDocumentShell>;
}
