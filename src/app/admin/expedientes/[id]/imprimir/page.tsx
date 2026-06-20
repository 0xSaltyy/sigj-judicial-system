import { notFound } from "next/navigation";
import { JudicialDocumentHeader, JudicialPrintFooter, JudicialWatermark } from "@/components/judicial-document";
import { PrintButton } from "@/components/print-button";
import { requirePermission } from "@/lib/auth/permissions";

export default async function CasePrint({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { supabase }] = await Promise.all([params, requirePermission({ resource: "expedientes", action: "view" })]);
  const [{ data: caseRecord }, { data: actions }, { data: hearings }, { data: proceedings }, { data: documents }] = await Promise.all([
    supabase.from("cases").select("*").eq("id", id).maybeSingle(),
    supabase.from("case_actions").select("*").eq("case_id", id),
    supabase.from("hearings").select("*").eq("case_id", id),
    supabase.from("proceedings").select("*").eq("case_id", id),
    supabase.from("documents").select("title,file_type,created_at").eq("case_id", id),
  ]);
  if (!caseRecord) notFound();
  return <div className="mx-auto max-w-5xl"><div className="mb-5 flex justify-end no-print"><PrintButton label="Imprimir / guardar PDF" /></div><article className="paper judicial-document border p-10"><JudicialWatermark /><JudicialDocumentHeader documentType="Expediente judicial" title={caseRecord.internal_number} dependency={caseRecord.chamber} metadata={[{ label: "Radicado", value: caseRecord.judicial_number }, { label: "Fecha", value: new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(caseRecord.filed_at)) }, { label: "Estado", value: caseRecord.status }, { label: "Reserva", value: caseRecord.confidentiality_level }]} /><section className="mt-8"><h2 className="font-bold uppercase text-[#153553]">Datos generales</h2><p className="mt-3 text-sm">{caseRecord.authority_type} · {caseRecord.chamber} · {caseRecord.process_type}</p><p className="mt-3 text-sm"><b>Partes:</b> {caseRecord.claimant_name} / {caseRecord.defendant_name}</p><p className="mt-3 text-sm">{caseRecord.summary}</p></section><PrintList title="Actuaciones" items={(actions ?? []).map((action) => `${action.action_date} · ${action.title}: ${action.description}`)} /><PrintList title="Audiencias" items={(hearings ?? []).map((hearing) => `${hearing.scheduled_at} · ${hearing.title} · ${hearing.status}`)} /><PrintList title="Providencias" items={(proceedings ?? []).map((proceeding) => `${proceeding.providence_number} · ${proceeding.title} · ${proceeding.status}`)} /><PrintList title="Documentos" items={(documents ?? []).map((document) => `${document.title} · ${document.file_type}`)} /><JudicialPrintFooter verification={`Verifique este documento con el radicado ${caseRecord.judicial_number}.`} /></article></div>;
}
function PrintList({ title, items }: { title: string; items: string[] }) { return <section className="mt-8"><h2 className="font-bold">{title}</h2>{items.length ? items.map((item) => <p key={item} className="mt-2 border-b pb-2 text-sm">{item}</p>) : <p className="mt-2 text-sm text-muted-foreground">Sin registros.</p>}</section>; }
