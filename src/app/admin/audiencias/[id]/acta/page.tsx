import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin-page";
import { PrintButton } from "@/components/print-button";
import { JudicialDocumentHeader, JudicialPrintFooter, JudicialWatermark } from "@/components/judicial-document";
import { requireInternalUser } from "@/lib/auth/authorization";

export default async function HearingMinutes({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { supabase }] = await Promise.all([params, requireInternalUser()]);
  const { data: hearing } = await supabase.from("hearings").select("*,case:cases(internal_number,judicial_number,title)").eq("id", id).maybeSingle();
  if (!hearing) notFound();
  const caseRecord = Array.isArray(hearing.case) ? hearing.case[0] : hearing.case;
  return <><AdminPageHeader title="Acta de audiencia" description={caseRecord?.internal_number ?? "Expediente"} action={<PrintButton label="Imprimir acta" />} /><article className="print-document judicial-document rounded-lg border bg-white p-10"><JudicialWatermark /><JudicialDocumentHeader documentType="Acta de audiencia" title={hearing.title} dependency={caseRecord?.title} metadata={[{ label: "Radicado", value: caseRecord?.judicial_number }, { label: "Fecha y hora", value: new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short" }).format(new Date(hearing.scheduled_at)) }, { label: "Sala", value: hearing.room || "Por definir" }, { label: "Estado", value: hearing.status }]} /><section className="mt-8"><h2 className="font-semibold uppercase text-[#153553]">Desarrollo y constancias</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{hearing.minutes_markdown || hearing.notes || "Acta pendiente de contenido."}</p></section><div className="judicial-signature mt-20 grid gap-12 text-center sm:grid-cols-2"><div className="border-t pt-2 text-xs">Responsable de la audiencia</div><div className="border-t pt-2 text-xs">Secretaría</div></div><JudicialPrintFooter verification={`Acta asociada al expediente ${caseRecord?.internal_number ?? "—"}.`} /></article></>;
}
