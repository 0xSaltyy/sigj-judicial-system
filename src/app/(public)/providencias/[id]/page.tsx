import { notFound } from "next/navigation";
import { FormalProvidenceDocument } from "@/components/formal-providence-document";
import { PrintButton } from "@/components/print-button";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Button } from "@/components/ui/button";
import { signatureImageDataUrl } from "@/lib/signature-images";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { publicProceedingRealtime } from "@/lib/realtime-subscriptions";

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
  const originalPdfUrl =
    admin && privateRecord?.pdf_path
      ? `/api/providencias/${id}/pdf?variant=original`
      : null;
  const combinedPdfUrl =
    admin && privateRecord?.pdf_path ? `/api/providencias/${id}/pdf` : null;
  const signatures = admin
    ? await Promise.all(
        (signatureRows ?? []).map(async (s) => ({
          ...s,
          imageUrl: await signatureImageDataUrl(admin, s.signature_image_path),
        })),
      )
    : [];
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <RealtimeRefresh
        channel={`public-proceeding-${id}`}
        subscriptions={publicProceedingRealtime(id)}
        protectUnsavedForms={false}
      />
      <div className="mb-5 flex justify-end no-print">
        <PrintButton
          label="Imprimir providencia"
          href={`/imprimir/providencias/${id}`}
        />
        {combinedPdfUrl && (
          <Button asChild className="ml-2">
            <a href={combinedPdfUrl} target="_blank" rel="noreferrer">
              PDF formal con firmas
            </a>
          </Button>
        )}
      </div>
      <p className="no-print -mt-2 mb-5 text-right text-xs text-muted-foreground">
        Para impresión limpia, desactive encabezados y pies del navegador o use
        el PDF formal.
      </p>
      <FormalProvidenceDocument
        proceeding={{
          ...proceeding,
          pdf_original_name: privateRecord?.pdf_original_name,
        }}
        caseRecord={proceeding}
        signatures={signatures}
        pdfUrl={originalPdfUrl}
        combinedPdfUrl={combinedPdfUrl}
        publicView
      />
    </div>
  );
}
