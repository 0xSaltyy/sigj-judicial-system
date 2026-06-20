import {
  JudicialDocumentHeader,
  JudicialPrintFooter,
  JudicialWatermark,
} from "@/components/judicial-document";
import { CorteSupremaLogo } from "@/components/corte-suprema-logo";
import { MarkdownViewer } from "@/components/markdown-editor";
import { SignaturePrintBlocks } from "@/components/signature-panel";
import type { PrintableSignature } from "@/components/formal-providence-document";
import { resolveTemplateStyle } from "@/lib/document-templates";

type HearingDocument = {
  title: string;
  scheduled_at: string;
  end_at?: string | null;
  room?: string | null;
  virtual_link?: string | null;
};

type MinuteDocument = {
  status: string;
  started_at?: string | null;
  ended_at?: string | null;
  chamber?: string | null;
  location_details?: string | null;
  interveners?: string | null;
  attendees?: string | null;
  absences?: string | null;
  development_markdown?: string | null;
  requests_markdown?: string | null;
  decisions_markdown?: string | null;
  evidence_markdown?: string | null;
  records_markdown?: string | null;
  observations_markdown?: string | null;
  closing_markdown?: string | null;
};

type HearingCaseDocument = {
  internal_number?: string | null;
  judicial_number?: string | null;
  title?: string | null;
  chamber?: string | null;
  authority_type?: string | null;
  dependency_name?: string | null;
};

export function HearingMinuteDocument({
  hearing,
  minute,
  caseRecord,
  signatures,
}: {
  hearing: HearingDocument;
  minute?: MinuteDocument | null;
  caseRecord?: HearingCaseDocument | null;
  signatures: PrintableSignature[];
}) {
  const dateTime = (value: string) =>
    new Intl.DateTimeFormat("es-CO", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "America/Bogota",
    }).format(new Date(value));
  const style = resolveTemplateStyle("auto", [
    caseRecord?.dependency_name,
    caseRecord?.authority_type,
    caseRecord?.chamber,
    minute?.chamber,
  ]);
  const start = dateTime(minute?.started_at ?? hearing.scheduled_at);
  const end = minute?.ended_at ? dateTime(minute.ended_at) : "Pendiente";
  const location = minute?.location_details || minute?.chamber || hearing.room || hearing.virtual_link || "Por definir";

  return (
    <article className={`print-document judicial-document formal-document--${style} rounded-lg border bg-white p-10`}>
      <JudicialWatermark />
      {style === "corte_suprema" ? (
        <header className="formal-header formal-header--csj">
          <CorteSupremaLogo width={132} className="formal-csj-logo" />
          <p className="formal-csj-room">{minute?.chamber || caseRecord?.chamber || "Sala judicial"}</p>
          <h1 className="mt-8 text-base font-bold uppercase">Acta de audiencia</h1>
          <p className="mt-2 font-bold uppercase">{hearing.title}</p>
          <dl className="formal-attachment-data text-left">
            <div><dt>Radicación n.°</dt><dd>{caseRecord?.judicial_number || caseRecord?.internal_number || "—"}</dd></div>
            <div><dt>Inicio</dt><dd>{start}</dd></div>
            <div><dt>Cierre</dt><dd>{end}</dd></div>
            <div><dt>Lugar / sala</dt><dd>{location}</dd></div>
          </dl>
        </header>
      ) : (
        <JudicialDocumentHeader
          documentType="Acta de audiencia"
          title={hearing.title}
          dependency={caseRecord?.title}
          metadata={[
            { label: "Radicado", value: caseRecord?.judicial_number },
            { label: "Inicio", value: start },
            { label: "Cierre", value: end },
            { label: "Lugar / sala", value: location },
            { label: "Estado", value: minute?.status || "Borrador" },
          ]}
        />
      )}
      <TextSection title="Intervinientes" content={minute?.interveners} plain />
      <TextSection title="Comparecientes" content={minute?.attendees} plain />
      <TextSection title="Inasistencias" content={minute?.absences} plain />
      <TextSection title="Desarrollo de la audiencia" content={minute?.development_markdown} />
      <TextSection title="Solicitudes presentadas" content={minute?.requests_markdown} />
      <TextSection title="Pruebas practicadas o decretadas" content={minute?.evidence_markdown} />
      <TextSection title="Decisiones adoptadas" content={minute?.decisions_markdown} />
      <TextSection title="Constancias" content={minute?.records_markdown} />
      <TextSection title="Observaciones" content={minute?.observations_markdown} />
      <TextSection title="Cierre" content={minute?.closing_markdown} />
      <SignaturePrintBlocks signatures={signatures} />
      <JudicialPrintFooter
        verificationPath="/audiencias"
        verification={`Acta asociada al expediente ${caseRecord?.internal_number ?? "—"}.${signatures.length ? ` Códigos de verificación: ${signatures.map((signature) => signature.verification_code).join(" · ")}.` : ""}`}
      />
    </article>
  );
}

function TextSection({
  title,
  content,
  plain,
}: {
  title: string;
  content?: string | null;
  plain?: boolean;
}) {
  if (!content) return null;
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="mb-3 font-semibold uppercase text-[#153553]">{title}</h2>
      {plain ? (
        <p className="whitespace-pre-wrap text-sm leading-7">{content}</p>
      ) : (
        <div className="[&>article]:min-h-0 [&>article]:border-0 [&>article]:p-0">
          <MarkdownViewer content={content} />
        </div>
      )}
    </section>
  );
}
