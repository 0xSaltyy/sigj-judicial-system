import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  JudicialDocumentHeader,
  JudicialPrintFooter,
  JudicialWatermark,
} from "@/components/judicial-document";
import { PrintDocumentShell } from "@/components/print-document-shell";
import { requirePermission } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Expediente judicial",
  robots: { index: false, follow: false },
};

export default async function CasePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { supabase }] = await Promise.all([
    params,
    requirePermission({ resource: "expedientes", action: "view" }),
  ]);
  const [
    { data: caseRecord },
    { data: actions },
    { data: hearings },
    { data: proceedings },
    { data: documents },
  ] = await Promise.all([
    supabase.from("cases").select("*").eq("id", id).maybeSingle(),
    supabase.from("case_actions").select("*").eq("case_id", id),
    supabase.from("hearings").select("*").eq("case_id", id),
    supabase.from("proceedings").select("*").eq("case_id", id),
    supabase.from("documents").select("title,file_type,created_at").eq("case_id", id),
  ]);
  if (!caseRecord) notFound();
  const formalActions = (actions ?? []).filter((action) => {
    const text = `${action.action_type ?? ""} ${action.title ?? ""} ${action.description ?? ""}`.toLowerCase();
    return !/(audit|permiso|descarg|previsual|usuario .* (creó|editó|modificó)|inicio de sesión|lock|bloqueo)/.test(text);
  });
  await supabase.rpc("log_security_event", { p_action: "FORMAL_CASE_PDF_EXPORTED", p_table: "cases", p_record_id: id, p_description: "Expediente formal exportado sin eventos internos de auditoría", p_metadata: { formal_actions: formalActions.length } });

  return (
    <PrintDocumentShell>
      <article className="print-document paper judicial-document border p-10">
        <JudicialWatermark />
        <JudicialDocumentHeader
          documentType="Expediente judicial"
          title={caseRecord.internal_number}
          dependency={caseRecord.chamber}
          metadata={[
            { label: "Radicado", value: caseRecord.judicial_number },
            { label: "Fecha", value: new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(caseRecord.filed_at)) },
            { label: "Estado", value: caseRecord.status },
            { label: "Reserva", value: caseRecord.confidentiality_level },
          ]}
        />
        <section className="mt-8">
          <h2 className="font-bold uppercase text-[#153553]">Datos generales</h2>
          <p className="mt-3 text-sm">{caseRecord.authority_type} · {caseRecord.chamber} · {caseRecord.process_type}</p>
          <p className="mt-3 text-sm"><b>Partes:</b> {caseRecord.claimant_name} / {caseRecord.defendant_name}</p>
          <p className="mt-3 text-sm">{caseRecord.summary}</p>
        </section>
        <PrintList title="Actuaciones judiciales formales" items={formalActions.map((action) => `${action.action_date} · ${action.title}: ${action.description}`)} />
        <PrintList title="Audiencias" items={(hearings ?? []).map((hearing) => `${hearing.scheduled_at} · ${hearing.title} · ${hearing.status}`)} />
        <PrintList title="Providencias" items={(proceedings ?? []).map((proceeding) => `${proceeding.providence_number} · ${proceeding.title} · ${proceeding.status}`)} />
        <PrintList title="Documentos" items={(documents ?? []).map((document) => `${document.title} · ${document.file_type}`)} />
        <JudicialPrintFooter
          verificationPath={`/consulta?radicado=${encodeURIComponent(caseRecord.judicial_number)}`}
          verification={`Verifique este documento con el radicado ${caseRecord.judicial_number}.`}
        />
      </article>
    </PrintDocumentShell>
  );
}

function PrintList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-8">
      <h2 className="font-bold">{title}</h2>
      {items.length ? items.map((item) => <p key={item} className="mt-2 border-b pb-2 text-sm">{item}</p>) : <p className="mt-2 text-sm text-muted-foreground">Sin registros.</p>}
    </section>
  );
}
