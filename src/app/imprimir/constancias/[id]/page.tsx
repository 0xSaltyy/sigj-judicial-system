import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PrintableSignature } from "@/components/formal-providence-document";
import {
  JudicialDocumentHeader,
  JudicialPrintFooter,
  JudicialWatermark,
} from "@/components/judicial-document";
import { PrintDocumentShell } from "@/components/print-document-shell";
import { SignaturePrintBlocks } from "@/components/signature-panel";
import { requirePermission } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "Constancia judicial",
  robots: { index: false, follow: false },
};

export default async function CertificatePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { supabase }] = await Promise.all([
    params,
    requirePermission({ resource: "documentos", action: "view" }),
  ]);
  const [{ data: caseRecord }, { data: certificate }] = await Promise.all([
    supabase.from("cases").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("certificates")
      .select("*")
      .eq("case_id", id)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!caseRecord) notFound();
  const { data: signatureRows } = certificate
    ? await supabase
        .from("signatures")
        .select("id,signer_name,signer_title,signature_image_path,purpose,signed_at,verification_code")
        .eq("target_type", "certificate")
        .eq("target_id", certificate.id)
        .eq("status", "signed")
        .order("signature_order")
    : { data: [] };
  const signatures: PrintableSignature[] = await Promise.all(
    (signatureRows ?? []).map(async (signature) => ({
      ...signature,
      imageUrl:
        (
          await supabase.storage
            .from("signatures")
            .createSignedUrl(signature.signature_image_path, 600)
        ).data?.signedUrl ?? null,
    })),
  );

  return (
    <PrintDocumentShell>
      <article className="print-document paper judicial-document min-h-[850px] border p-12">
        <JudicialWatermark />
        <JudicialDocumentHeader
          documentType={certificate?.certificate_type ?? "Constancia de radicación"}
          title={certificate?.certificate_number ?? caseRecord.internal_number}
          dependency={caseRecord.chamber}
          metadata={[
            { label: "Radicado", value: caseRecord.judicial_number },
            { label: "Fecha", value: formatDate(certificate?.issued_at ?? caseRecord.filed_at) },
            { label: "Proceso", value: `${caseRecord.process_type} · ${caseRecord.process_subtype}` },
            { label: "Estado", value: caseRecord.status },
          ]}
        />
        <section className="my-10 text-justify text-sm leading-7">
          <p>
            {certificate?.content ?? (
              <>La Secretaría deja constancia de que el asunto identificado con el número interno <strong>{caseRecord.internal_number}</strong> fue recibido y registrado en el Sistema Integral de Gestión Judicial.</>
            )}
          </p>
          <p className="mt-5"><strong>Resumen:</strong> {caseRecord.summary}</p>
        </section>
        {signatures.length ? (
          <SignaturePrintBlocks signatures={signatures} />
        ) : (
          <div className="judicial-signature mt-24 text-center">
            <div className="mx-auto w-72 border-t border-slate-700 pt-2 text-xs">Secretaría responsable</div>
          </div>
        )}
        <JudicialPrintFooter
          verificationPath={`/consulta?radicado=${encodeURIComponent(caseRecord.judicial_number)}`}
          verification={`Constancia asociada al radicado ${caseRecord.judicial_number}.`}
        />
      </article>
    </PrintDocumentShell>
  );
}
