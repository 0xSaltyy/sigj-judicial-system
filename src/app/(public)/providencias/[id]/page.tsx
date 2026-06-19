import { notFound } from "next/navigation";
import {
  JudicialDocumentHeader,
  JudicialPrintFooter,
  JudicialWatermark,
} from "@/components/judicial-document";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PrintButton } from "@/components/print-button";
import { SignaturePrintBlocks } from "@/components/signature-panel";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function ProceedingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: proceeding } = await supabase
    .from("public_proceedings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!proceeding) notFound();
  const admin = createAdminClient();
  const [{ data: privateRecord }, { data: signatureRows }] = admin
    ? await Promise.all([
        admin
          .from("proceedings")
          .select("pdf_path,pdf_original_name")
          .eq("id", id)
          .single(),
        admin
          .from("signatures")
          .select(
            "id,signer_name,signer_title,signature_image_path,purpose,signed_at,verification_code",
          )
          .eq("target_type", "proceeding")
          .eq("target_id", id)
          .eq("status", "signed")
          .order("signature_order"),
      ])
    : [{ data: null }, { data: [] }];
  const pdfUrl =
    admin && privateRecord?.pdf_path
      ? ((
          await admin.storage
            .from("providence-files")
            .createSignedUrl(privateRecord.pdf_path, 600)
        ).data?.signedUrl ?? null)
      : null;
  const signatures = admin
    ? await Promise.all(
        (signatureRows ?? []).map(async (s) => ({
          ...s,
          imageUrl:
            (
              await admin.storage
                .from("signatures")
                .createSignedUrl(s.signature_image_path, 600)
            ).data?.signedUrl ?? null,
        })),
      )
    : [];
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-5 flex justify-end no-print">
        <PrintButton label="Imprimir providencia" />
      </div>
      <article className="paper judicial-document min-h-[900px] border p-12">
        <JudicialWatermark />
        <JudicialDocumentHeader
          documentType={proceeding.type}
          title={proceeding.title}
          dependency={proceeding.chamber}
          metadata={[
            { label: "Providencia", value: proceeding.providence_number },
            { label: "Radicado", value: proceeding.judicial_number },
            { label: "Expediente", value: proceeding.internal_number },
            { label: "Fecha", value: proceeding.providence_date },
            {
              label: "Publicación",
              value: proceeding.published_at
                ? new Intl.DateTimeFormat("es-CO", {
                    dateStyle: "long",
                  }).format(new Date(proceeding.published_at))
                : "—",
            },
          ]}
        />
        {pdfUrl ? (
          <>
            <iframe
              src={pdfUrl}
              title={proceeding.title}
              className="mt-8 h-[760px] w-full rounded border no-print"
            />
            <p className="mt-8 hidden rounded border p-4 text-sm print:block">
              La providencia original corresponde al PDF adjunto “
              {privateRecord?.pdf_original_name}”. Esta hoja certifica sus
              metadatos y firmas capturadas por SIGJ.
            </p>
          </>
        ) : (
          <div className="mt-8">
            <MarkdownViewer content={proceeding.content_markdown} />
          </div>
        )}
        <SignaturePrintBlocks signatures={signatures} />
        <JudicialPrintFooter
          verification={`Providencia ${proceeding.providence_number}.`}
        />
      </article>
    </div>
  );
}
