import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck2, ExternalLink, FileText, MapPin, Users } from "lucide-react";
import { markHearingCompleted } from "@/app/actions/hearings";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { HearingMinuteActions } from "@/components/hearing-minute-actions";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { hearingEditorRealtime } from "@/lib/realtime-subscriptions";

export default async function HearingDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;success?:string}>}){
  const [{id},query,{supabase,profile}]=await Promise.all([params,searchParams,requirePermission(PERMISSIONS.hearingsView)]);
  const [{data:hearing},{data:minute},canEdit,canComplete,canViewMinutes,canCreateMinutes,canEditMinutes,canAudit]=await Promise.all([
    supabase.from("hearing_agenda_secure").select("*").eq("id",id).maybeSingle(),
    supabase.from("hearing_minutes").select("id,status,created_at,finalized_at").eq("hearing_id",id).maybeSingle(),
    can(profile,"edit","audiencias",{supabase}),can(profile,"mark_completed","audiencias",{supabase}),can(profile,"view","actas",{supabase}),can(profile,"create","actas",{supabase}),can(profile,"edit","actas",{supabase}),can(profile,"view","auditoria",{supabase}),
  ]);
  if(!hearing)notFound();
  const {data:documents}=await supabase.from("documents").select("id,title,file_type,created_at").eq("case_id",hearing.case_id).is("archived_at",null).order("created_at",{ascending:false}).limit(20);
  const participants:string[]=Array.isArray(hearing.participants)?hearing.participants.map((item:unknown)=>typeof item==="string"?item:(item as {name?:string}).name??"").filter(Boolean):[];
  const completed=hearing.status==="Realizada";const status=hearing.archived_at?"Archivada":completed?(minute?(minute.status==="Borrador"?"Pendiente de acta":"Acta generada"):"Pendiente de acta"):hearing.status;
  const {data:audit}=canAudit?await supabase.from("audit_logs").select("id,action,description,created_at").eq("table_name","hearings").eq("record_id",id).order("created_at",{ascending:false}).limit(20):{data:[]};
  return <>
    <RealtimeRefresh channel={`hearing-${id}`} subscriptions={hearingEditorRealtime(id)}/>
    <AdminPageHeader title={hearing.title} description={`${hearing.hearing_type} · ${hearing.internal_number??"Sin expediente"}`} action={<div className="flex flex-wrap gap-2">{canEdit&&<Button asChild variant="outline"><Link href={`/admin/audiencias/${id}/editar`}>Editar audiencia</Link></Button>}<HearingMinuteActions hearingId={id} minuteStatus={minute?.status} canView={canViewMinutes} canCreate={canCreateMinutes} canEdit={canEditMinutes} archived={Boolean(hearing.archived_at)}/></div>}/>
    <ActionMessage error={query.error} success={query.success}/>
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Información de la audiencia</CardTitle><Badge variant="outline">{status}</Badge></div></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2"><Fact label="Expediente" value={hearing.internal_number??"Sin expediente"}/><Fact label="Radicado judicial" value={hearing.judicial_number??"Sin radicado"}/><Fact label="Fecha e inicio" value={formatDate(hearing.scheduled_at)}/><Fact label="Finalización prevista" value={hearing.end_at?formatDate(hearing.end_at):"Sin duración definida"}/><Fact label="Despacho" value={hearing.dependency_name??"Sin despacho"}/><Fact label="Juez, magistrado o ponente" value={hearing.judge_is_owner?"Lilith D'Amico":hearing.judge_name??"Sin juez asignado"}/><Fact label="Ubicación" value={hearing.room||"Sin ubicación"}/><Fact label="Modalidad" value={hearing.virtual_link?"Virtual o híbrida":"Presencial"}/></dl>{hearing.virtual_link&&<Button asChild size="sm" variant="outline" className="mt-4"><a href={hearing.virtual_link} target="_blank" rel="noreferrer"><ExternalLink className="size-4"/>Abrir enlace virtual</a></Button>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-4"/>Comparecientes y notas</CardTitle></CardHeader><CardContent className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Participantes</p>{participants.length?<ul className="mt-2 grid gap-2 sm:grid-cols-2">{participants.map((name:string)=><li key={name} className="break-words rounded border bg-slate-50 px-3 py-2 text-sm">{name}</li>)}</ul>:<p className="mt-2 text-sm text-muted-foreground">Sin participantes registrados.</p>}</div><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descripción y notas</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{hearing.notes||"Sin notas registradas."}</p></div></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-4"/>Documentos del expediente</CardTitle></CardHeader><CardContent>{documents?.length?<ul className="space-y-2">{documents.map((document)=><li key={document.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded border p-3"><span className="min-w-0 break-words text-sm font-medium">{document.title}</span><Button asChild size="sm" variant="outline"><Link href={`/api/admin/documents/${document.id}/file`} target="_blank">Abrir</Link></Button></li>)}</ul>:<p className="text-sm text-muted-foreground">No hay documentos disponibles en el expediente.</p>}</CardContent></Card>
      </div>
      <aside className="space-y-5">
        <Card><CardHeader><CardTitle>Flujo del acta</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm">{minute?`Acta ${minute.status.toLocaleLowerCase("es")}.`:completed?"La audiencia está realizada y el acta está pendiente.":"El acta se crea después de realizar la audiencia."}</p>{!completed&&!hearing.archived_at&&<form action={markHearingCompleted}><input type="hidden" name="hearing_id" value={id}/><input type="hidden" name="case_id" value={hearing.case_id}/><ConfirmSubmitButton message="¿Confirmar que la audiencia fue realizada? El acta quedará pendiente." disabled={!canComplete}><CalendarCheck2 className="size-4"/>{canComplete?"Marcar como realizada":"Sin permiso para finalizar"}</ConfirmSubmitButton></form>}<HearingMinuteActions hearingId={id} minuteStatus={minute?.status} canView={canViewMinutes} canCreate={canCreateMinutes} canEdit={canEditMinutes} archived={Boolean(hearing.archived_at)}/></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="size-4"/>Expediente</CardTitle></CardHeader><CardContent><p className="break-words text-sm">{hearing.ticket_name||hearing.case_title||"Sin título de expediente"}</p><Button asChild variant="outline" size="sm" className="mt-3"><Link href={`/admin/expedientes/${hearing.case_id}`}>Abrir expediente</Link></Button><p className="mt-2 text-[11px] text-muted-foreground">El expediente se abrirá únicamente si también cuenta con permiso sobre él.</p></CardContent></Card>
        {canAudit&&<Card><CardHeader><CardTitle>Actividad auditada</CardTitle></CardHeader><CardContent>{audit?.length?<ul className="space-y-3">{audit.map((entry)=><li key={entry.id} className="border-l-2 pl-3 text-xs"><p className="font-semibold">{entry.description}</p><time className="text-muted-foreground">{formatDate(entry.created_at)}</time></li>)}</ul>:<p className="text-sm text-muted-foreground">Sin eventos específicos disponibles.</p>}</CardContent></Card>}
      </aside>
    </div>
  </>;
}
function Fact({label,value}:{label:string;value:string}){return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>}
function formatDate(value:string){return new Intl.DateTimeFormat("es-CO",{dateStyle:"long",timeStyle:"short"}).format(new Date(value));}
