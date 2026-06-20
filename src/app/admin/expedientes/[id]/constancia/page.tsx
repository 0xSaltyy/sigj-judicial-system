import { notFound } from "next/navigation";
import { JudicialDocumentHeader, JudicialPrintFooter, JudicialWatermark } from "@/components/judicial-document";
import { PrintButton } from "@/components/print-button";
import { requirePermission } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/demo-data";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { supabase }] = await Promise.all([params, requirePermission({ resource: "expedientes", action: "view" })]);
  const { data: caseRecord } = await supabase.from("cases").select("*").eq("id", id).maybeSingle();
  if (!caseRecord) notFound();
  return <div className="mx-auto max-w-4xl"><div className="mb-5 flex justify-end no-print"><PrintButton label="Imprimir constancia" /></div><article className="paper judicial-document min-h-[850px] border p-12"><JudicialWatermark /><JudicialDocumentHeader documentType="Constancia de radicación" title={caseRecord.internal_number} dependency={caseRecord.chamber} metadata={[{ label: "Radicado", value: caseRecord.judicial_number }, { label: "Fecha", value: formatDate(caseRecord.filed_at) }, { label: "Proceso", value: `${caseRecord.process_type} · ${caseRecord.process_subtype}` }, { label: "Estado", value: caseRecord.status }]} /><section className="my-10 text-justify text-sm leading-7"><p>La Secretaría deja constancia de que el asunto identificado con el número interno <strong>{caseRecord.internal_number}</strong> fue recibido y registrado en el Sistema Integral de Gestión Judicial.</p><p className="mt-5"><strong>Resumen:</strong> {caseRecord.summary}</p></section><div className="judicial-signature mt-24 text-center"><div className="mx-auto w-72 border-t border-slate-700 pt-2 text-xs">Secretaría responsable</div></div><JudicialPrintFooter verification={`Constancia asociada al radicado ${caseRecord.judicial_number}.`} /></article></div>;
}
