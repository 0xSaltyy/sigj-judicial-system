import { notFound } from "next/navigation";
import { JudicialDocumentHeader, JudicialPrintFooter, JudicialWatermark } from "@/components/judicial-document";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";

export default async function NoticeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: notice } = await supabase.from("public_notices").select("*").eq("slug", slug).eq("status", "Publicado").maybeSingle();
  if (!notice) notFound();
  return <div className="mx-auto max-w-4xl px-4 py-12"><div className="mb-5 flex items-center justify-between no-print"><Badge variant="outline">{notice.category}</Badge><PrintButton href={`/imprimir/comunicados/${slug}`} /></div><article className="paper judicial-document rounded-lg border p-10"><JudicialWatermark /><JudicialDocumentHeader documentType="Comunicado institucional" title={notice.title} dependency={notice.issuing_entity} metadata={[{ label: "Categoría", value: notice.category }, { label: "Publicación", value: formatDate(notice.published_at) }, { label: "Entidad", value: notice.issuing_entity }, { label: "Referencia", value: notice.slug }]} /><div className="mt-8"><MarkdownViewer content={notice.content_markdown} /></div><JudicialPrintFooter verification={`Comunicado institucional: ${notice.slug}.`} /></article></div>;
}
