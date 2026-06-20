import { notFound } from "next/navigation";
import {
  finalizeHearingMinutes,
  reopenHearingMinutes,
  saveHearingMinutes,
} from "@/app/actions/hearings";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ClearDrafts } from "@/components/clear-drafts";
import { DraftForm } from "@/components/draft-form";
import { HearingMinuteDocument } from "@/components/hearing-minute-document";
import { MarkdownEditor } from "@/components/markdown-editor";
import { PrintButton } from "@/components/print-button";
import {
  SignaturePanel,
} from "@/components/signature-panel";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { can, requirePermission } from "@/lib/auth/permissions";
import { signatureImageDataUrl } from "@/lib/signature-images";
import { hearingMinuteRealtime } from "@/lib/realtime-subscriptions";

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
    requirePermission({ resource: "actas", action: "view" }),
  ]);
  const [{ data: hearing }, { data: minute }] = await Promise.all([
    supabase
      .from("hearings")
      .select("*,case:cases(internal_number,judicial_number,title,chamber,authority_type,dependency:dependencies(name))")
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
  const dependency = Array.isArray(caseRecord?.dependency)
    ? caseRecord.dependency[0]
    : caseRecord?.dependency;
  const formalCaseRecord = {
    ...caseRecord,
    dependency_name: dependency?.name || null,
  };
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
      imageUrl: await signatureImageDataUrl(supabase, s.signature_image_path),
    })),
  );
  const [canCreate, canEdit, canFinalize, canReopen, canActaSign, canSign, canRequestSignatures, canRevokeSignatures, canPrint, canArchive] = await Promise.all([
    can(profile, "create", "actas", { supabase }),
    can(profile, "edit", "actas", { supabase }),
    can(profile, "finalize", "actas", { supabase }),
    can(profile, "reopen", "actas", { supabase }),
    can(profile, "sign", "actas", { supabase }),
    can(profile, "sign", "firmas", { supabase }),
    can(profile, "request", "firmas", { supabase }),
    can(profile, "revoke", "firmas", { supabase }),
    can(profile, "print", "actas", { supabase }),
    can(profile, "archive", "actas", { supabase }),
  ]);
  const local = (value?: string | null) =>
    value ? new Date(value).toISOString().slice(0, 16) : "";
  const editable = (!minute && canCreate) || (minute?.status === "Borrador" && canEdit);
  const finalized = minute && ["Finalizada", "Firmada"].includes(minute.status);
  const signed = minute?.status === "Firmada";
  return (
    <>
      <RealtimeRefresh
        channel={`admin-hearing-minute-${id}`}
        subscriptions={hearingMinuteRealtime(id, minute?.id)}
        mode={editable ? "prompt" : "auto"}
        promptMessage="Hay cambios nuevos en esta acta. Actualizar vista."
      />
      {query.success && <ClearDrafts storageKeys={[`hearing-minute:${id}`]} />}
      <AdminPageHeader
        title="Acta de audiencia"
        description={`${caseRecord?.internal_number ?? "Expediente"} · ${minute?.status ?? "Sin iniciar"}`}
        action={finalized ? (canPrint ? <PrintButton label={signed ? "PDF/Imprimir acta firmada" : "Imprimir acta"} href={`/imprimir/actas/${id}`} /> : <Button disabled title="No tiene permiso para imprimir actas">Imprimir acta</Button>) : undefined}
      />
      <div className="no-print -mt-3 mb-5 rounded-lg border bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span className="font-semibold text-[#153553]">Flujo del acta:</span> redactar y guardar borrador → finalizar → solicitar/capturar firmas → imprimir.
        {finalized && <span className="ml-1">Para impresión limpia, desactive encabezados y pies del navegador.</span>}
      </div>
      <ActionMessage error={query.error} success={query.success} />
      {!minute && !canCreate && <p className="no-print mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Puede consultar actas, pero no tiene permiso para crear el acta de esta audiencia.</p>}
      {minute?.status === "Borrador" && !canEdit && <p className="no-print mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">El acta está en borrador y se muestra en modo de consulta. Su usuario no tiene permiso para editarla.</p>}
      {editable && (
        <DraftForm
          action={saveHearingMinutes}
          storageKey={`hearing-minute:${id}`}
          className="mb-6 grid gap-5 rounded-xl border bg-white p-6 md:grid-cols-2"
        >
          {minute && <input type="hidden" name="minute_id" value={minute.id} />}
          <input type="hidden" name="hearing_id" value={id} />
          <input type="hidden" name="case_id" value={hearing.case_id} />
          <Field label="Hora de inicio real">
            <Input
              type="datetime-local"
              name="started_at"
              defaultValue={local(minute?.started_at ?? hearing.scheduled_at)}
            />
          </Field>
          <Field label="Hora de finalización real">
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
          <Field label="Lugar / sala / enlace" wide>
            <Input
              name="location_details"
              defaultValue={minute?.location_details ?? hearing.virtual_link ?? hearing.room ?? ""}
              placeholder="Sala física, dirección o enlace de conexión"
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
          <Field label="Solicitudes presentadas" wide>
            <MarkdownEditor
              name="requests_markdown"
              initialValue={minute?.requests_markdown ?? ""}
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
      {finalized && (
        <SignaturePanel
          caseId={hearing.case_id}
          targetType="hearing_minute"
          targetId={minute.id}
          destination={`/admin/audiencias/${id}/acta`}
          signingLink={query.signingLink}
          canRequest={canRequestSignatures}
          canRevoke={canRevokeSignatures}
          canSign={canSign && canActaSign}
        />
      )}
      {minute?.status === "Borrador" && canFinalize && (
        <form
          action={finalizeHearingMinutes}
          className="my-5 rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <input type="hidden" name="minute_id" value={minute.id} />
          <input type="hidden" name="hearing_id" value={id} />
          <input type="hidden" name="case_id" value={hearing.case_id} />
          <ConfirmSubmitButton message="¿Finalizar el acta? Después quedará en solo lectura.">
            Finalizar acta
          </ConfirmSubmitButton>
        </form>
      )}
      {minute?.status === "Borrador" && !canFinalize && <p className="no-print my-5 rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">El borrador sólo puede finalizarlo un usuario con permiso para finalizar actas.</p>}
      {finalized && canReopen && (
        <form action={reopenHearingMinutes} className="no-print my-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <input type="hidden" name="minute_id" value={minute.id} />
          <input type="hidden" name="hearing_id" value={id} />
          <input type="hidden" name="case_id" value={hearing.case_id} />
          <p className="mb-3 text-sm text-slate-700">La reapertura devuelve el acta a borrador y queda auditada. {signatures.length ? "Primero debe revocar todas las firmas vigentes." : "Use esta opción sólo para una corrección justificada."}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input name="reason" minLength={10} maxLength={500} required placeholder="Motivo obligatorio de reapertura" disabled={signatures.length > 0} />
            <ConfirmSubmitButton message="¿Reabrir esta acta para edición?" variant="outline" disabled={signatures.length > 0}>Reabrir acta</ConfirmSubmitButton>
          </div>
        </form>
      )}
      {minute && minute.status !== "Archivada" && (
        <div className="no-print my-5">
          <LifecycleActions
            resource="hearing_minutes"
            recordId={minute.id}
            recordLabel={`Acta de audiencia ${caseRecord?.internal_number ?? id}`}
            destination={`/admin/audiencias/${id}/acta`}
            archived={false}
            canArchive={canArchive}
            canRestore={false}
            canHardDelete={false}
          />
        </div>
      )}
      {minute && <HearingMinuteDocument hearing={hearing} minute={minute} caseRecord={formalCaseRecord} signatures={signatures} />}
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
