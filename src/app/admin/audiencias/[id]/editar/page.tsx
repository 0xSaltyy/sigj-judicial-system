import { notFound } from "next/navigation";
import { cancelHearing } from "@/app/actions/hearings";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ClearDrafts } from "@/components/clear-drafts";
import { HearingForm } from "@/components/hearing-form";
import { HearingMinuteActions } from "@/components/hearing-minute-actions";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Input } from "@/components/ui/input";
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { hearingEditorRealtime } from "@/lib/realtime-subscriptions";
export default async function EditHearing({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, query, { supabase, profile }] = await Promise.all([
    params,
    searchParams,
    requirePermission(PERMISSIONS.hearingsEdit),
  ]);
  const [{ data: hearing }, { data: cases }, { data: minute }, canViewMinutes, canCreateMinutes, canEditMinutes, canReschedule, canCancel, canComplete] = await Promise.all([
    supabase.from("hearing_agenda_secure").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("cases")
      .select("id,internal_number")
      .order("filed_at", { ascending: false })
      .limit(100),
    supabase.from("hearing_minutes").select("id,status").eq("hearing_id", id).maybeSingle(),
    can(profile, "view", "actas", { supabase }),
    can(profile, "create", "actas", { supabase }),
    can(profile, "edit", "actas", { supabase }),
    can(profile, "reschedule", "audiencias", { supabase }),
    can(profile, "cancel", "audiencias", { supabase }),
    can(profile, "mark_completed", "audiencias", { supabase }),
  ]);
  if (!hearing) notFound();
  const caseOptions=(cases??[]).some((item)=>item.id===hearing.case_id)?(cases??[]):[...(cases??[]),{id:hearing.case_id,internal_number:hearing.internal_number??"Expediente de la audiencia"}];
  return (
    <>
      <RealtimeRefresh
        channel={`admin-hearing-editor-${id}`}
        subscriptions={hearingEditorRealtime(id)}
        mode="prompt"
        promptMessage="Hay cambios nuevos en esta audiencia. Actualizar vista."
      />
      {query.success && <ClearDrafts storageKeys={[`sigj:hearing:${hearing.case_id}`, `sigj:hearing:${id}`]} />}
      <AdminPageHeader
        title="Editar audiencia"
        description="Reprogramación, estado, participantes y cancelación."
        action={<div className="flex flex-wrap gap-2"><HearingMinuteActions hearingId={id} minuteStatus={minute?.status} canView={canViewMinutes} canCreate={canCreateMinutes} canEdit={canEditMinutes} archived={Boolean(hearing.archived_at)} /></div>}
      />
      <ActionMessage error={query.error} success={query.success} />
      <HearingForm cases={caseOptions} hearing={hearing} canReschedule={canReschedule} canCancel={canCancel} canComplete={canComplete} />
      {hearing.status !== "Cancelada" && (
        <form
          action={cancelHearing}
          className="mt-5 flex max-w-4xl gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <input type="hidden" name="hearing_id" value={hearing.id} />
          <input type="hidden" name="case_id" value={hearing.case_id} />
          <Input
            name="cancellation_reason"
            required
            placeholder="Motivo de cancelación"
          />
          <ConfirmSubmitButton
            message="¿Cancelar esta audiencia?"
            variant="destructive"
            disabled={!canCancel}
          >
            {canCancel ? "Cancelar audiencia" : "Sin permiso para cancelar"}
          </ConfirmSubmitButton>
        </form>
      )}
    </>
  );
}
