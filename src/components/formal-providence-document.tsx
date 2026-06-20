import Image from "next/image";
import { JudicialPrintFooter, JudicialWatermark } from "@/components/judicial-document";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PdfProvidencePreview } from "@/components/pdf-providence-preview";
import { SignaturePrintBlocks } from "@/components/signature-panel";
import {
  type DocumentMetadata,
  renderDocumentPlaceholders,
  resolveTemplateStyle,
  writtenDate,
} from "@/lib/document-templates";

export type PrintableSignature = {
  id: string;
  signer_name: string;
  signer_title: string;
  purpose: string;
  signed_at: string;
  verification_code: string;
  imageUrl: string | null;
};

type ProceedingDocument = {
  id: string;
  providence_number: string;
  title: string;
  type: string;
  chamber: string;
  content_markdown: string;
  creation_mode: "editor" | "pdf" | "mixed";
  providence_date?: string | null;
  pdf_original_name?: string | null;
  template_style?: string | null;
  document_metadata?: DocumentMetadata | null;
};

type CaseDocument = {
  internal_number?: string | null;
  judicial_number?: string | null;
  authority_type?: string | null;
  chamber?: string | null;
  claimant_name?: string | null;
  defendant_name?: string | null;
  municipality?: string | null;
  dependency_name?: string | null;
};

export function FormalProvidenceDocument({
  proceeding,
  caseRecord,
  signatures,
  pdfUrl,
  combinedPdfUrl,
  publicView = false,
}: {
  proceeding: ProceedingDocument;
  caseRecord: CaseDocument;
  signatures: PrintableSignature[];
  pdfUrl?: string | null;
  combinedPdfUrl?: string | null;
  publicView?: boolean;
}) {
  const metadata = proceeding.document_metadata || {};
  const style = resolveTemplateStyle(proceeding.template_style, [
    caseRecord.dependency_name,
    caseRecord.authority_type,
    caseRecord.chamber,
    proceeding.chamber,
  ]);
  const context = {
    ...metadata,
    judicialNumber: caseRecord.judicial_number,
    internalNumber: caseRecord.internal_number,
    providenceDate: proceeding.providence_date,
    chamber: proceeding.chamber,
    dependency: caseRecord.dependency_name || proceeding.chamber,
    documentType: proceeding.type,
    title: proceeding.title,
    claimantName: metadata.claimantName || caseRecord.claimant_name || undefined,
    defendantName: metadata.defendantName || caseRecord.defendant_name || undefined,
    verificationCode: signatures[0]?.verification_code,
  };
  const body = renderDocumentPlaceholders(proceeding.content_markdown, context);
  const uploadedOnly = proceeding.creation_mode === "pdf";
  if (uploadedOnly) {
    return (
      <div className="space-y-6">
        <PdfProvidencePreview
          title={proceeding.title}
          providenceNumber={proceeding.providence_number}
          documentType={proceeding.type}
          documentDate={proceeding.providence_date}
          originalName={proceeding.pdf_original_name}
          originalUrl={pdfUrl}
          combinedUrl={combinedPdfUrl}
        />
        {signatures.length > 0 && (
          <section className="paper judicial-document rounded-lg border bg-white p-8">
            <h2 className="text-center text-sm font-bold uppercase tracking-wide text-[#153553]">Firmas registradas</h2>
            <SignaturePrintBlocks signatures={signatures} />
          </section>
        )}
        {publicView && <p className="text-center text-[9px] text-slate-400">Sistema ficticio de demostración académica. No corresponde a una autoridad judicial real ni produce efectos jurídicos.</p>}
      </div>
    );
  }
  return (
    <article className={`paper judicial-document formal-document formal-document--${style} relative mx-auto bg-white`}>
      <JudicialWatermark />
      <InstitutionHeader
        style={style}
        proceeding={proceeding}
        caseRecord={caseRecord}
        metadata={metadata}
      />
      <h1 className="formal-document-title">{proceeding.title}</h1>
      <div className="judicial-body mt-8">
        <MarkdownViewer content={body} variant="document" />
      </div>
      {proceeding.creation_mode === "mixed" && pdfUrl && (
        <section className="no-print mt-8 border-t pt-6">
          <p className="mb-3 text-sm font-semibold">PDF original adjunto</p>
          <iframe src={pdfUrl} title={`PDF ${proceeding.providence_number}`} className="h-[680px] w-full rounded border bg-slate-100" />
        </section>
      )}
      {metadata.footnotes && <aside className="judicial-footnotes">{metadata.footnotes}</aside>}
      <SignaturePrintBlocks signatures={signatures} />
      <JudicialPrintFooter
        verificationPath={`/providencias/${proceeding.id}`}
        verification={
          signatures[0]?.verification_code
            ? `Código de verificación: ${signatures.map((item) => item.verification_code).join(" · ")}`
            : `Providencia ${proceeding.providence_number}.`
        }
      />
      {publicView && (
        <p className="mt-3 text-center text-[8px] text-slate-400">
          Sistema ficticio de demostración académica. No corresponde a una autoridad judicial real ni produce efectos jurídicos.
        </p>
      )}
    </article>
  );
}

function InstitutionHeader({
  style,
  proceeding,
  caseRecord,
  metadata,
}: {
  style: "corte_suprema" | "tribunal_superior" | "juzgado" | "blank";
  proceeding: ProceedingDocument;
  caseRecord: CaseDocument;
  metadata: DocumentMetadata;
}) {
  const city = metadata.city || caseRecord.municipality || "Bogotá, D.C.";
  const room = metadata.roomName || proceeding.chamber || caseRecord.chamber || "Sala judicial";
  const dependency = caseRecord.dependency_name || proceeding.chamber || "Despacho judicial";
  const radicado = caseRecord.judicial_number || caseRecord.internal_number || "—";
  if (style === "corte_suprema") {
    return (
      <header className="formal-header formal-header--csj">
        <Emblem size={88} />
        <p className="formal-kicker">CORTE SUPREMA DE JUSTICIA</p>
        <p className="formal-room">{room}</p>
        {metadata.rapporteurName && (
          <div className="mt-8">
            <p className="font-bold uppercase">{metadata.rapporteurName}</p>
            <p>Magistrado/a ponente</p>
          </div>
        )}
        <div className="mt-8 leading-7">
          <p>{metadata.documentCode || proceeding.providence_number}</p>
          <p className="font-bold">Radicación n.° {radicado}</p>
          {metadata.actNumber && <p>(Aprobado Acta No. {metadata.actNumber})</p>}
        </div>
        <p className="mt-8 text-left">{city}, {writtenDate(proceeding.providence_date)}.</p>
      </header>
    );
  }
  if (style === "blank") {
    return (
      <header className="formal-header formal-header--blank">
        <Emblem size={70} />
        <p className="formal-kicker">REPÚBLICA DE COLOMBIA</p>
        <p className="formal-room">RAMA JUDICIAL DEL PODER PÚBLICO</p>
        <p className="mt-3">{dependency}</p>
        <p className="mt-1 font-semibold">Radicado No. {radicado}</p>
      </header>
    );
  }
  const tribunal = style === "tribunal_superior";
  return (
    <header className="formal-header">
      <p className="formal-kicker">REPÚBLICA DE COLOMBIA</p>
      <p className="formal-room">RAMA JUDICIAL DEL PODER PÚBLICO</p>
      <Emblem size={84} />
      <p className="formal-kicker mt-4">
        {tribunal ? `TRIBUNAL SUPERIOR DE ${city.replace(/,\s*D\.C\.$/i, "").toUpperCase()}` : dependency.toUpperCase()}
      </p>
      <p className="formal-room">{room}</p>
      <p className="mt-1 font-bold">Radicado No. {radicado}</p>
      <MetadataTable
        rows={
          tribunal
            ? [
                ["ACCIONANTE", metadata.claimantName || caseRecord.claimant_name],
                ["ACCIONADO / PRESUNTA VINCULADA", metadata.linkedPartyName || metadata.defendantName || caseRecord.defendant_name],
                ["ASUNTO", metadata.subject || proceeding.title],
                ["MAGISTRADO/A PONENTE", metadata.rapporteurName || "—"],
              ]
            : [
                ["ASUNTO", metadata.subject || proceeding.title],
                ["DESPACHO", dependency],
                ["FECHA", writtenDate(proceeding.providence_date)],
              ]
        }
      />
    </header>
  );
}

function MetadataTable({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return (
    <dl className="formal-metadata-table">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Emblem({ size }: { size: number }) {
  return (
    <span className="mx-auto my-5 flex items-center justify-center">
      <Image
        src="/escudo-institucional.png"
        alt="Escudo institucional de Colombia"
        width={size}
        height={size}
        className="h-auto object-contain"
        style={{ width: size, maxHeight: size }}
        priority
      />
    </span>
  );
}
