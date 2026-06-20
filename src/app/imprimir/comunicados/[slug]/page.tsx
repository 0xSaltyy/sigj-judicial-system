import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  JudicialDocumentHeader,
  JudicialPrintFooter,
  JudicialWatermark,
} from "@/components/judicial-document";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PrintDocumentShell } from "@/components/print-document-shell";
import { formatDate } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Documento institucional",
  robots: { index: false, follow: false },
};

export default async function NoticePrintPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: notice } = await supabase
    .from("public_notices")
    .select("*")
    .eq("slug", slug)
    .eq("status", "Publicado")
    .maybeSingle();
  if (!notice) notFound();

  return (
    <PrintDocumentShell>
      <article className="print-document paper judicial-document rounded-lg border p-10">
        <JudicialWatermark />
        <JudicialDocumentHeader
          documentType="Comunicado institucional"
          title={notice.title}
          dependency={notice.issuing_entity}
          metadata={[
            { label: "Categoría", value: notice.category },
            { label: "Publicación", value: formatDate(notice.published_at) },
            { label: "Entidad", value: notice.issuing_entity },
            { label: "Referencia", value: notice.slug },
          ]}
        />
        <div className="mt-8"><MarkdownViewer content={notice.content_markdown} /></div>
        <JudicialPrintFooter verificationPath={`/comunicados/${slug}`} verification={`Comunicado institucional: ${notice.slug}.`} />
      </article>
    </PrintDocumentShell>
  );
}
