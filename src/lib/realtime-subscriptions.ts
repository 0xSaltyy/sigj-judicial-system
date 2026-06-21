import type { RealtimeSubscription } from "@/components/realtime-refresh";

export const CASE_LIST_REALTIME = [
  {
    table: "cases",
    messages: {
      INSERT: "Se agregó un expediente nuevo.",
      UPDATE: "Se actualizó un expediente.",
      DELETE: "Se eliminó un expediente.",
    },
  },
] as const satisfies readonly RealtimeSubscription[];

export const PROCEEDING_LIST_REALTIME = [
  { table: "proceedings", message: "La lista de providencias fue actualizada." },
  { table: "signatures", message: "Una providencia recibió cambios de firma." },
] as const satisfies readonly RealtimeSubscription[];

export const HEARING_LIST_REALTIME = [
  { table: "hearings", message: "La agenda de audiencias fue actualizada." },
  { table: "hearing_minutes", message: "El estado de un acta fue actualizado." },
] as const satisfies readonly RealtimeSubscription[];

export const DASHBOARD_REALTIME = [
  { table: "cases", message: "Se actualizaron los expedientes recientes." },
  { table: "documents", message: "Se registraron cambios en documentos." },
  { table: "proceedings", message: "Se actualizaron las providencias pendientes." },
  { table: "hearings", message: "Se actualizó la agenda de audiencias." },
  { table: "hearing_minutes", message: "Se actualizó el estado de un acta." },
  { table: "signature_requests", message: "Se actualizaron las firmas pendientes." },
  { table: "signatures", message: "Se registró un cambio de firma." },
  { table: "judicial_states", message: "Se actualizaron los estados judiciales." },
] as const satisfies readonly RealtimeSubscription[];

export const NOTICE_LIST_REALTIME = [
  { table: "public_notices", message: "Se actualizaron los comunicados." },
] as const satisfies readonly RealtimeSubscription[];

export const STATE_LIST_REALTIME = [
  { table: "judicial_states", message: "Se actualizaron los estados judiciales." },
  { table: "judicial_state_items", message: "Se actualizaron las actuaciones de un estado." },
] as const satisfies readonly RealtimeSubscription[];

export function caseDetailRealtime(caseId: string): readonly RealtimeSubscription[] {
  const caseFilter = `case_id=eq.${caseId}`;
  return [
    { table: "cases", filter: `id=eq.${caseId}`, message: "Este expediente fue actualizado por otro usuario." },
    { table: "documents", filter: caseFilter, message: "Los documentos del expediente fueron actualizados." },
    { table: "proceedings", filter: caseFilter, message: "Las providencias del expediente fueron actualizadas." },
    { table: "hearings", filter: caseFilter, message: "Las audiencias del expediente fueron actualizadas." },
    { table: "hearing_minutes", filter: caseFilter, message: "El acta de una audiencia fue actualizada." },
    { table: "case_actions", filter: caseFilter, message: "La línea de tiempo del expediente fue actualizada." },
    { table: "radications", filter: caseFilter, message: "La información de radicación fue actualizada." },
    { table: "case_parties", filter: caseFilter, message: "Las partes del expediente fueron actualizadas." },
    { table: "notifications", filter: caseFilter, message: "Las notificaciones del expediente fueron actualizadas." },
    { table: "certificates", filter: caseFilter, message: "Las constancias del expediente fueron actualizadas." },
    { table: "signature_requests", filter: caseFilter, message: "Las solicitudes de firma fueron actualizadas." },
    { table: "signatures", filter: caseFilter, message: "Se registró un cambio de firma en el expediente." },
    { table: "record_shares", filter: caseFilter, message: "Los accesos compartidos fueron actualizados." },
    { table: "share_links", filter: caseFilter, message: "Los enlaces compartidos fueron actualizados." },
  ];
}

export function caseEditorRealtime(caseId: string): readonly RealtimeSubscription[] {
  return [
    { table: "cases", filter: `id=eq.${caseId}`, message: "Hay cambios nuevos en este expediente." },
    { table: "case_parties", filter: `case_id=eq.${caseId}`, message: "Las partes del expediente cambiaron." },
  ];
}

export function proceedingDetailRealtime(
  proceedingId: string,
  caseId: string,
): readonly RealtimeSubscription[] {
  return [
    { table: "proceedings", filter: `id=eq.${proceedingId}`, message: "La providencia fue actualizada." },
    { table: "cases", filter: `id=eq.${caseId}`, message: "El expediente asociado fue actualizado." },
    { table: "signature_requests", filter: `target_id=eq.${proceedingId}`, message: "Las solicitudes de firma fueron actualizadas." },
    { table: "signatures", filter: `target_id=eq.${proceedingId}`, message: "La providencia recibió una actualización de firma." },
    { table: "vote_documents", filter: `proceeding_id=eq.${proceedingId}`, message: "Se actualizó un voto particular." },
    { table: "sala_sessions", filter: `proceeding_id=eq.${proceedingId}`, message: "Se actualizó el registro de Sala." },
  ];
}

export function proceedingEditorRealtime(proceedingId: string): readonly RealtimeSubscription[] {
  return [
    { table: "proceedings", filter: `id=eq.${proceedingId}`, message: "Hay cambios nuevos en esta providencia." },
  ];
}

export function publicProceedingRealtime(
  proceedingId: string,
): readonly RealtimeSubscription[] {
  return [
    {
      table: "proceedings",
      filter: `id=eq.${proceedingId}`,
      message: "La providencia pública fue actualizada.",
    },
  ];
}

export function hearingEditorRealtime(hearingId: string): readonly RealtimeSubscription[] {
  return [
    { table: "hearings", filter: `id=eq.${hearingId}`, message: "Hay cambios nuevos en esta audiencia." },
    { table: "hearing_minutes", filter: `hearing_id=eq.${hearingId}`, message: "El acta de audiencia fue actualizada." },
  ];
}

export function hearingMinuteRealtime(
  hearingId: string,
  minuteId?: string,
): readonly RealtimeSubscription[] {
  const subscriptions: RealtimeSubscription[] = [
    { table: "hearings", filter: `id=eq.${hearingId}`, message: "La audiencia fue actualizada." },
    { table: "hearing_minutes", filter: `hearing_id=eq.${hearingId}`, message: "El acta fue actualizada o finalizada." },
  ];
  if (minuteId) {
    subscriptions.push(
      { table: "signature_requests", filter: `target_id=eq.${minuteId}`, message: "Las solicitudes de firma del acta fueron actualizadas." },
      { table: "signatures", filter: `target_id=eq.${minuteId}`, message: "El acta recibió una actualización de firma." },
    );
  }
  return subscriptions;
}

export function noticeDetailRealtime(noticeId: string): readonly RealtimeSubscription[] {
  return [{ table: "public_notices", filter: `id=eq.${noticeId}`, message: "Hay cambios nuevos en este comunicado." }];
}

export function stateDetailRealtime(stateId: string): readonly RealtimeSubscription[] {
  return [
    { table: "judicial_states", filter: `id=eq.${stateId}`, message: "El estado judicial fue actualizado." },
    { table: "judicial_state_items", filter: `judicial_state_id=eq.${stateId}`, message: "Las actuaciones del estado fueron actualizadas." },
  ];
}
