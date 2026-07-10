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

type HearingDetailRow={id:string;case_id:string|null;title:string|null;hearing_type:string|null;scheduled_at:string|null;end_at:string|null;room:string|null;virtual_link:string|null;status:string|null;participants:unknown;notes:string|null;archived_at:string|null;internal_number:string|null;judicial_number:string|null;case_title:string|null;ticket_name:string|null;dependency_name:string|null;judge_name:string|null;judge_is_owner:boolean|null};

export default async function HearingDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;success?:string}>}){
  const [{id},query,{supabase,profile}]=await Promise.all([params,searchParams,requirePermission(PERMISSIONS.hearingsView)]);
  const [hearingResult,{data:minute},canEdit,canComplete,canViewMinutes,canCreateMinutes,canEditMinutes,canAudit]=await Promise.all([
    loadHearingDetail(supabase,id),
    supabase.from("hearing_minutes").select("id,status,created_at,finalized_at").eq("hearing_id",id).maybeSingle(),
    can(profile,"edit","audiencias",{supabase}),can(profile,"mark_completed","audiencias",{supabase}),can(profile,"view","actas",{supabase}),can(profile,"create","actas",{supabase}),can(profile,"edit","actas",{supabase}),can(profile,"view","auditoria",{supabase}),
  ]);
  const hearing=hearingResult.data;
  if(!hearing)notFound();
  const {data:documents}=hearing.case_id?await supabase.from("documents").select("id,title,file_type,created_at").eq("case_id",hearing.case_id).is("archived_at",null).order("created_at",{ascending:false}).limit(20):{data:[]};
  const participants:string[]=Array.isArray(hearing.participants)?hearing.participants.map((item:unknown)=>typeof item==="string"?item:(item as {name?:string}).name??"").filter(Boolean):[];
  const completed=hearing.status==="Realizada";const status=hearing.archived_at?"Archivada":completed?(minute?(minute.status==="Borrador"?"Pendiente de acta":"Acta generada"):"Pendiente de acta"):hearing.status;
  const {data:audit}=canAudit?await supabase.from("audit_logs").select("id,action,description,created_at").eq("table_name","hearings").eq("record_id",id).order("created_at",{ascending:false}).limit(20):{data:[]};
  return <>
    <RealtimeRefresh channel={`hearing-${id}`} subscriptions={hearingEditorRealtime(id)}/>
    <AdminPageHeader title={hearing.title??"Audiencia sin título"} description={`${hearing.hearing_type??"Audiencia"} · ${hearing.internal_number??"Sin expediente"}`} action={<div className="flex flex-wrap gap-2">{canEdit&&<Button asChild variant="outline"><Link href={`/admin/audiencias/${id}/editar`}>Editar audiencia</Link></Button>}<HearingMinuteActions hearingId={id} minuteStatus={minute?.status} canView={canViewMinutes} canCreate={canCreateMinutes} canEdit={canEditMinutes} archived={Boolean(hearing.archived_at)}/></div>}/>
    <ActionMessage error={query.error} success={query.success}/>
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Información de la audiencia</CardTitle><Badge variant="outline">{status??"Sin estado"}</Badge></div></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2"><Fact label="Expediente" value={hearing.internal_number??"Sin expediente"}/><Fact label="Radicado judicial" value={hearing.judicial_number??"Sin radicado"}/><Fact label="Fecha e inicio" value={formatDate(hearing.scheduled_at)}/><Fact label="Finalización prevista" value={formatDate(hearing.end_at,"Sin duración definida")}/><Fact label="Despacho" value={hearing.dependency_name??"Sin despacho"}/><Fact label="Juez, magistrado o ponente" value={hearing.judge_is_owner?"Lilith D'Amico":hearing.judge_name??"Sin juez asignado"}/><Fact label="Ubicación" value={hearing.room||"Sin ubicación"}/><Fact label="Modalidad" value={hearing.virtual_link?"Virtual o híbrida":"Presencial"}/></dl>{hearing.virtual_link&&<Button asChild size="sm" variant="outline" className="mt-4"><a href={hearing.virtual_link} target="_blank" rel="noreferrer"><ExternalLink className="size-4"/>Abrir enlace virtual</a></Button>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-4"/>Comparecientes y notas</CardTitle></CardHeader><CardContent className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Participantes</p>{participants.length?<ul className="mt-2 grid gap-2 sm:grid-cols-2">{participants.map((name:string)=><li key={name} className="break-words rounded border bg-slate-50 px-3 py-2 text-sm">{name}</li>)}</ul>:<p className="mt-2 text-sm text-muted-foreground">Sin participantes registrados.</p>}</div><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descripción y notas</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{hearing.notes||"Sin notas registradas."}</p></div></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-4"/>Documentos del expediente</CardTitle></CardHeader><CardContent>{documents?.length?<ul className="space-y-2">{documents.map((document)=><li key={document.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded border p-3"><span className="min-w-0 break-words text-sm font-medium">{document.title}</span><Button asChild size="sm" variant="outline"><Link href={`/api/admin/documents/${document.id}/file`} target="_blank">Abrir</Link></Button></li>)}</ul>:<p className="text-sm text-muted-foreground">No hay documentos disponibles en el expediente.</p>}</CardContent></Card>
      </div>
      <aside className="space-y-5">
        <Card><CardHeader><CardTitle>Flujo del acta</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm">{minute?`Acta ${minute.status.toLocaleLowerCase("es")}.`:completed?"La audiencia está realizada y el acta está pendiente.":"El acta se crea después de realizar la audiencia."}</p>{!completed&&!hearing.archived_at&&hearing.case_id&&<form action={markHearingCompleted}><input type="hidden" name="hearing_id" value={id}/><input type="hidden" name="case_id" value={hearing.case_id}/><ConfirmSubmitButton message="¿Confirmar que la audiencia fue realizada? El acta quedará pendiente." disabled={!canComplete}><CalendarCheck2 className="size-4"/>{canComplete?"Marcar como realizada":"Sin permiso para finalizar"}</ConfirmSubmitButton></form>}<HearingMinuteActions hearingId={id} minuteStatus={minute?.status} canView={canViewMinutes} canCreate={canCreateMinutes} canEdit={canEditMinutes} archived={Boolean(hearing.archived_at)}/></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="size-4"/>Expediente</CardTitle></CardHeader><CardContent><p className="break-words text-sm">{hearing.ticket_name||hearing.case_title||"Sin título de expediente"}</p>{hearing.case_id?<Button asChild variant="outline" size="sm" className="mt-3"><Link href={`/admin/expedientes/${hearing.case_id}`}>Abrir expediente</Link></Button>:<p className="mt-3 rounded border bg-slate-50 p-3 text-sm text-muted-foreground">Sin expediente vinculado disponible.</p>}<p className="mt-2 text-[11px] text-muted-foreground">El expediente se abrirá únicamente si también cuenta con permiso sobre él.</p></CardContent></Card>
        {canAudit&&<Card><CardHeader><CardTitle>Actividad auditada</CardTitle></CardHeader><CardContent>{audit?.length?<ul className="space-y-3">{audit.map((entry)=><li key={entry.id} className="border-l-2 pl-3 text-xs"><p className="font-semibold">{entry.description}</p><time className="text-muted-foreground">{formatDate(entry.created_at)}</time></li>)}</ul>:<p className="text-sm text-muted-foreground">Sin eventos específicos disponibles.</p>}</CardContent></Card>}
      </aside>
    </div>
  </>;
}
function Fact({label,value}:{label:string;value:string}){return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>}
async function loadHearingDetail(supabase: Awaited<ReturnType<typeof requirePermission>>["supabase"], id:string): Promise<{data:HearingDetailRow|null}> {
  const primary=await supabase.from("hearing_agenda_secure").select("*").eq("id",id).maybeSingle();
  if(!primary.error&&primary.data)return {data:primary.data as HearingDetailRow};
  const fallback=await supabase.from("hearings").select("id,case_id,title,hearing_type,scheduled_at,end_at,room,virtual_link,status,participants,notes,archived_at,cases(internal_number,judicial_number,title,ticket_name,dependency_id,assigned_judge_id)").eq("id",id).maybeSingle();
  if(fallback.error||!fallback.data)return {data:null};
  const hearing=fallback.data as Record<string,unknown>;
  const caseRow=firstRelation(hearing.cases);
  let dependencyName:string|null=null;let judgeName:string|null=null;let judgeIsOwner=false;
  const dependencyId=stringOrNull(caseRow?.dependency_id);
  const judgeId=stringOrNull(caseRow?.assigned_judge_id);
  if(dependencyId){const {data}=await supabase.from("dependencies").select("name").eq("id",dependencyId).maybeSingle();dependencyName=data?.name??null;}
  if(judgeId){const {data}=await supabase.from("profiles").select("full_name,is_owner").eq("id",judgeId).maybeSingle();judgeName=data?.is_owner?"Lilith D'Amico":data?.full_name??null;judgeIsOwner=Boolean(data?.is_owner);}
  return {data:{id:String(hearing.id),case_id:stringOrNull(hearing.case_id),title:stringOrNull(hearing.title),hearing_type:stringOrNull(hearing.hearing_type),scheduled_at:stringOrNull(hearing.scheduled_at),end_at:stringOrNull(hearing.end_at),room:stringOrNull(hearing.room),virtual_link:stringOrNull(hearing.virtual_link),status:stringOrNull(hearing.status),participants:hearing.participants??[],notes:stringOrNull(hearing.notes),archived_at:stringOrNull(hearing.archived_at),internal_number:stringOrNull(caseRow?.internal_number),judicial_number:stringOrNull(caseRow?.judicial_number),case_title:stringOrNull(caseRow?.title),ticket_name:stringOrNull(caseRow?.ticket_name),dependency_name:dependencyName,judge_name:judgeName,judge_is_owner:judgeIsOwner}};
}
function firstRelation(value:unknown):Record<string,unknown>|null{if(Array.isArray(value))return (value[0] as Record<string,unknown>|undefined)??null;return value&&typeof value==="object"?value as Record<string,unknown>:null;}
function stringOrNull(value:unknown){return typeof value==="string"&&value.length?value:null;}
function formatDate(value:string|null|undefined,fallback="Fecha no definida"){const time=value?new Date(value).getTime():Number.NaN;return Number.isNaN(time)?fallback:new Intl.DateTimeFormat("es-CO",{dateStyle:"long",timeStyle:"short"}).format(new Date(time));}
