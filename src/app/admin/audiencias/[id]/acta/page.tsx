import { notFound } from "next/navigation";
import {
  finalizeHearingMinutes,
  saveHearingMinutes,
} from "@/app/actions/hearings";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ClearDrafts } from "@/components/clear-drafts";
import { DraftForm } from "@/components/draft-form";
import {
  JudicialDocumentHeader,
  JudicialPrintFooter,
  JudicialWatermark,
} from "@/components/judicial-document";
import { MarkdownEditor, MarkdownViewer } from "@/components/markdown-editor";
import { PrintButton } from "@/components/print-button";
import {
  SignaturePanel,
  SignaturePrintBlocks,
} from "@/components/signature-panel";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function HearingMinutes({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
    signingLink?: string;
  }>;
}) {
  const [{ id }, query, { supabase, profile }] = await Promise.all([
    params,
    searchParams,
    requirePermission(PERMISSIONS.minutesEdit),
  ]);
  const [{ data: hearing }, { data: minute }] = await Promise.all([
    supabase
      .from("hearings")
      .select("*,case:cases(internal_number,judicial_number,title,chamber)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("hearing_minutes")
      .select("*")
      .eq("hearing_id", id)
      .maybeSingle(),
  ]);
  if (!hearing) notFound();
  const caseRecord = Array.isArray(hearing.case)
    ? hearing.case[0]
    : hearing.case;
  const { data: signatureRows } = minute
    ? await supabase
        .from("signatures")
        .select(
          "id,signer_name,signer_title,signature_image_path,purpose,signed_at,verification_code",
        )
        .eq("target_type", "hearing_minute")
        .eq("target_id", minute.id)
        .eq("status", "signed")
        .order("signature_order")
    : { data: [] };
  const signatures = await Promise.all(
    (signatureRows ?? []).map(async (s) => ({
      ...s,
      imageUrl:
        (
          await supabase.storage
            .from("signatures")
            .createSignedUrl(s.signature_image_path, 900)
        ).data?.signedUrl ?? null,
    })),
  );
  const local = (value?: string | null) =>
    value ? new Date(value).toISOString().slice(0, 16) : "";
  const editable = !minute || minute.status === "Borrador";
  return (
    <>
      {query.success && <ClearDrafts storageKeys={[`hearing-minute:${id}`]} />}
      <AdminPageHeader
        title="Acta de audiencia"
        description={`${caseRecord?.internal_number ?? "Expediente"} · ${minute?.status ?? "Sin iniciar"}`}
        action={<PrintButton label="Imprimir acta" />}
      />
      <ActionMessage error={query.error} success={query.success} />
      {editable && (
        <DraftForm
          action={saveHearingMinutes}
          storageKey={`hearing-minute:${id}`}
          className="mb-6 grid gap-5 rounded-xl border bg-white p-6 md:grid-cols-2"
        >
          {minute && <input type="hidden" name="minute_id" value={minute.id} />}
          <input type="hidden" name="hearing_id" value={id} />
          <input type="hidden" name="case_id" value={hearing.case_id} />
          <Field label="Inicio">
            <Input
              type="datetime-local"
              name="started_at"
              defaultValue={local(minute?.started_at ?? hearing.scheduled_at)}
            />
          </Field>
          <Field label="Cierre">
            <Input
              type="datetime-local"
              name="ended_at"
              defaultValue={local(minute?.ended_at ?? hearing.end_at)}
            />
          </Field>
          <Field label="Despacho / sala">
            <Input
              name="chamber"
              defaultValue={
                minute?.chamber ?? hearing.room ?? caseRecord?.chamber ?? ""
              }
            />
          </Field>
          <Field label="Tipo de audiencia">
            <Input value={hearing.hearing_type} readOnly />
          </Field>
          <Field label="Intervinientes" wide>
            <Textarea
              name="interveners"
              defaultValue={minute?.interveners ?? ""}
              className="min-h-24"
            />
          </Field>
          <Field label="Comparecientes" wide>
            <Textarea
              name="attendees"
              defaultValue={minute?.attendees ?? ""}
              className="min-h-24"
            />
          </Field>
          <Field label="Inasistencias" wide>
            <Textarea
              name="absences"
              defaultValue={minute?.absences ?? ""}
              className="min-h-20"
            />
          </Field>
          <Field label="Desarrollo de la audiencia" wide>
            <MarkdownEditor
              name="development_markdown"
              initialValue={
                minute?.development_markdown ??
                "# Desarrollo de la audiencia\n\n"
              }
            />
          </Field>
          <Field label="Decisiones adoptadas" wide>
            <MarkdownEditor
              name="decisions_markdown"
              initialValue={minute?.decisions_markdown ?? ""}
            />
          </Field>
          <Field label="Pruebas practicadas o decretadas" wide>
            <MarkdownEditor
              name="evidence_markdown"
              initialValue={minute?.evidence_markdown ?? ""}
            />
          </Field>
          <Field label="Constancias" wide>
            <MarkdownEditor
              name="records_markdown"
              initialValue={minute?.records_markdown ?? ""}
            />
          </Field>
          <Field label="Observaciones" wide>
            <MarkdownEditor
              name="observations_markdown"
              initialValue={minute?.observations_markdown ?? ""}
            />
          </Field>
          <Field label="Cierre" wide>
            <MarkdownEditor
              name="closing_markdown"
              initialValue={minute?.closing_markdown ?? ""}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="secretary_signature_required"
              value="true"
              defaultChecked={minute?.secretary_signature_required ?? true}
            />
            Requerir firma de Secretaría
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="judge_signature_required"
              value="true"
              defaultChecked={minute?.judge_signature_required ?? false}
            />
            Requerir firma de juez/magistrado
          </label>
          <div className="md:col-span-2">
            <SubmitButton pendingLabel="Guardando borrador…">
              Guardar borrador
            </SubmitButton>
          </div>
        </DraftForm>
      )}
      {minute && (
        <SignaturePanel
          caseId={hearing.case_id}
          targetType="hearing_minute"
          targetId={minute.id}
          destination={`/admin/audiencias/${id}/acta`}
          signingLink={query.signingLink}
        />
      )}
      {minute?.status === "Borrador" && (
        <form
          action={finalizeHearingMinutes}
          className="my-5 rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <input type="hidden" name="minute_id" value={minute.id} />
          <input type="hidden" name="hearing_id" value={id} />
          <input type="hidden" name="case_id" value={hearing.case_id} />
          {profile.is_owner && (
            <label className="mb-3 flex items-center gap-2 text-xs text-amber-950">
              <input type="checkbox" name="owner_override" value="true" />
              Excepción SUPER_ADMIN a requisitos de firma (queda auditada)
            </label>
          )}
          <ConfirmSubmitButton message="¿Finalizar el acta? Después quedará en solo lectura.">
            Finalizar / cerrar acta
          </ConfirmSubmitButton>
        </form>
      )}
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
              value: new Intl.DateTimeFormat("es-CO", {
                dateStyle: "long",
                timeStyle: "short",
              }).format(new Date(minute?.started_at ?? hearing.scheduled_at)),
            },
            {
              label: "Cierre",
              value: minute?.ended_at
                ? new Intl.DateTimeFormat("es-CO", {
                    dateStyle: "long",
                    timeStyle: "short",
                  }).format(new Date(minute.ended_at))
                : "Pendiente",
            },
            {
              label: "Sala",
              value: minute?.chamber || hearing.room || "Por definir",
            },
            { label: "Estado", value: minute?.status || "Borrador" },
          ]}
        />
        <TextSection
          title="Intervinientes"
          content={minute?.interveners}
          plain
        />
        <TextSection title="Comparecientes" content={minute?.attendees} plain />
        <TextSection title="Inasistencias" content={minute?.absences} plain />
        <TextSection
          title="Desarrollo de la audiencia"
          content={minute?.development_markdown}
        />
        <TextSection
          title="Decisiones adoptadas"
          content={minute?.decisions_markdown}
        />
        <TextSection
          title="Pruebas practicadas o decretadas"
          content={minute?.evidence_markdown}
        />
        <TextSection title="Constancias" content={minute?.records_markdown} />
        <TextSection
          title="Observaciones"
          content={minute?.observations_markdown}
        />
        <TextSection title="Cierre" content={minute?.closing_markdown} />
        <SignaturePrintBlocks signatures={signatures} />
        <JudicialPrintFooter
          verification={`Acta asociada al expediente ${caseRecord?.internal_number ?? "—"}.`}
        />
      </article>
    </>
  );
}
function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`text-sm ${wide ? "md:col-span-2" : ""}`}>
      <span className="mb-2 block font-medium">{label}</span>
      {children}
    </label>
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
