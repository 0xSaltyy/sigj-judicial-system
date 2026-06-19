import { notFound } from "next/navigation";
import { JudicialDocumentHeader, JudicialPrintFooter, JudicialWatermark } from "@/components/judicial-document";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PrintButton } from "@/components/print-button";
import { createClient } from "@/lib/supabase/server";

export default async function ProceedingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: proceeding } = await supabase.from("public_proceedings").select("*").eq("id", id).maybeSingle();
  if (!proceeding) notFound();
  return <div className="mx-auto max-w-4xl px-4 py-12"><div className="mb-5 flex justify-end no-print"><PrintButton label="Imprimir providencia" /></div><article className="paper judicial-document min-h-[900px] border p-12"><JudicialWatermark /><JudicialDocumentHeader documentType="Providencia judicial" title={proceeding.title} dependency={proceeding.chamber} metadata={[{ label: "Providencia", value: proceeding.providence_number }, { label: "Radicado", value: proceeding.judicial_number }, { label: "Expediente", value: proceeding.internal_number }, { label: "Publicación", value: proceeding.published_at ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(proceeding.published_at)) : "—" }]} /><div className="mt-8"><MarkdownViewer content={proceeding.content_markdown} /></div><div className="judicial-signature mt-16 text-center"><div className="mx-auto w-72 border-t pt-2 text-xs">Firma responsable</div></div><JudicialPrintFooter verification={`Providencia ${proceeding.providence_number}.`} /></article></div>;
}
