import {
  JudicialDocumentHeader,
  JudicialPrintFooter,
  JudicialWatermark,
} from "@/components/judicial-document";
import { MarkdownViewer } from "@/components/markdown-editor";
import { SignaturePrintBlocks } from "@/components/signature-panel";
import type { PrintableSignature } from "@/components/formal-providence-document";

type HearingDocument = {
  title: string;
  scheduled_at: string;
  end_at?: string | null;
  room?: string | null;
};

type MinuteDocument = {
  status: string;
  started_at?: string | null;
  ended_at?: string | null;
  chamber?: string | null;
  interveners?: string | null;
  attendees?: string | null;
  absences?: string | null;
  development_markdown?: string | null;
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

  return (
    <article className="print-document judicial-document rounded-lg border bg-white p-10">
      <JudicialWatermark />
      <JudicialDocumentHeader
        documentType="Acta de audiencia"
        title={hearing.title}
        dependency={caseRecord?.title}
        metadata={[
          { label: "Radicado", value: caseRecord?.judicial_number },
          {
            label: "Inicio",
            value: dateTime(minute?.started_at ?? hearing.scheduled_at),
          },
          {
            label: "Cierre",
            value: minute?.ended_at ? dateTime(minute.ended_at) : "Pendiente",
          },
          {
            label: "Sala",
            value: minute?.chamber || hearing.room || "Por definir",
          },
          { label: "Estado", value: minute?.status || "Borrador" },
        ]}
      />
      <TextSection title="Intervinientes" content={minute?.interveners} plain />
      <TextSection title="Comparecientes" content={minute?.attendees} plain />
      <TextSection title="Inasistencias" content={minute?.absences} plain />
      <TextSection title="Desarrollo de la audiencia" content={minute?.development_markdown} />
      <TextSection title="Decisiones adoptadas" content={minute?.decisions_markdown} />
      <TextSection title="Pruebas practicadas o decretadas" content={minute?.evidence_markdown} />
      <TextSection title="Constancias" content={minute?.records_markdown} />
      <TextSection title="Observaciones" content={minute?.observations_markdown} />
      <TextSection title="Cierre" content={minute?.closing_markdown} />
      <SignaturePrintBlocks signatures={signatures} />
      <JudicialPrintFooter
        verificationPath="/audiencias"
        verification={`Acta asociada al expediente ${caseRecord?.internal_number ?? "—"}.`}
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
