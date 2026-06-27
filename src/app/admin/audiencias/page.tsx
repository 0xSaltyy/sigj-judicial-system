import Link from "next/link";
import { CalendarCheck2, CalendarClock, CalendarPlus, ClipboardPenLine, Search } from "lucide-react";
import { AdminPageHeader, MetricCard } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { HearingCalendar, type HearingCalendarItem, statusLabel } from "@/components/hearing-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { can, requirePermission } from "@/lib/auth/permissions";
import { HEARING_LIST_REALTIME } from "@/lib/realtime-subscriptions";

type Query={q?:string;status?:string;dependency?:string;institution?:string;from?:string;to?:string;scope?:string};
type HearingRow={id:string;case_id:string;title:string;hearing_type:string;scheduled_at:string;end_at:string|null;room:string|null;virtual_link:string|null;status:string;participants:unknown;created_by:string|null;archived_at:string|null;internal_number:string|null;judicial_number:string|null;case_title:string|null;ticket_name:string|null;dependency_id:string|null;assigned_judge_id:string|null;dependency_name:string|null;judge_name:string|null;judge_is_owner:boolean|null;minute_id:string|null;minute_status:string|null};
type SafeQueryResult<T>={data:T[];error?:SafeError|null};
type SafeError={code?:string;message?:string;details?:string;hint?:string};

export default async function AdminHearingsPage({searchParams}:{searchParams:Promise<Query&{error?:string;success?:string}>}) {
  const {supabase,profile}=await requirePermission({resource:"audiencias",action:"view"});
  const query=await searchParams;
  const [canCreate,canViewDependency,canViewInstitution,canViewAll,agenda,{data:dependencies,error:dependenciesError},{data:profiles,error:profilesError}]=await Promise.all([
    can(profile,"create","audiencias",{supabase}),can(profile,"view_dependency","audiencias",{supabase}),can(profile,"view_institution","audiencias",{supabase}),can(profile,"view_all","audiencias",{supabase}),
    loadHearingAgenda(supabase,profile),
    supabase.from("dependencies").select("id,name,parent_id,type").eq("is_active",true).is("archived_at",null).order("name"),
    supabase.from("profiles").select("id,full_name,is_owner"),
  ]);
  logAdminDiagnostic("admin/audiencias","dependencies",dependenciesError,profile);
  logAdminDiagnostic("admin/audiencias","profiles",profilesError,profile);
  const nameById=new Map((profiles??[]).map((item)=>[item.id,item.is_owner?"Lilith D'Amico":item.full_name]));
  const depRows=dependencies??[];const children=new Map<string,string[]>();for(const dep of depRows){if(dep.parent_id)children.set(dep.parent_id,[...(children.get(dep.parent_id)??[]),dep.id]);}
  const institutionIds=query.institution?descendants(query.institution,children):null;
  const normalized=(query.q??"").trim().toLocaleLowerCase("es");
  const items=(agenda.data as HearingRow[]).map((row)=>toItem(row,nameById)).filter((item)=>{
    const haystack=`${item.title} ${item.type} ${item.radicado} ${item.caseTitle} ${item.dependency} ${item.judge} ${item.location} ${item.participants} ${item.createdBy}`.toLocaleLowerCase("es");
    if(normalized&&!haystack.includes(normalized))return false;
    if(query.status&&item.status!==query.status)return false;
    if(query.dependency&&item.dependencyId!==query.dependency)return false;
    if(institutionIds&&!institutionIds.has(item.dependencyId??""))return false;
    if(query.from&&new Date(item.scheduledAt)<new Date(`${query.from}T00:00:00`))return false;
    if(query.to&&new Date(item.scheduledAt)>new Date(`${query.to}T23:59:59`))return false;
    if(query.scope==="mine"&&item.judgeId!==profile.id&&item.createdById!==profile.id)return false;
    if(query.scope==="dependency"&&item.dependencyId!==profile.dependency_id)return false;
    return true;
  });
  const now=Date.now();const today=new Date();today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(today.getDate()+1);
  const todayCount=items.filter((item)=>{const value=new Date(item.scheduledAt);return value>=today&&value<tomorrow&&!isClosed(item.status);}).length;
  const upcoming=items.filter((item)=>new Date(item.scheduledAt).getTime()>=now&&!isClosed(item.status)).length;
  const completed=items.filter((item)=>["realizada","pendiente_acta","acta_generada"].includes(item.status)).length;
  const pendingMinutes=items.filter((item)=>item.status==="pendiente_acta").length;
  return <>
    <RealtimeRefresh channel="admin-hearings" subscriptions={HEARING_LIST_REALTIME}/>
    <AdminPageHeader title="Agenda de audiencias" description="Calendario, búsqueda y seguimiento de audiencias dentro de su alcance institucional." action={canCreate?<Button asChild className="bg-[#153b5c]"><Link href="/admin/audiencias/nueva"><CalendarPlus className="size-4"/>Programar audiencia</Link></Button>:<Button disabled title="No tiene permiso para crear audiencias"><CalendarPlus className="size-4"/>Programar audiencia</Button>}/>
    <ActionMessage error={query.error??(agenda.error?"No fue posible cargar la agenda completa. Se muestran los datos disponibles para su perfil.":undefined)} success={query.success}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Hoy" value={String(todayCount)} detail="Audiencias activas del día" icon={<CalendarCheck2 className="size-5"/>}/><MetricCard label="Próximas" value={String(upcoming)} detail="Programadas o reprogramadas" icon={<CalendarClock className="size-5"/>}/><MetricCard label="Realizadas" value={String(completed)} detail="Permanecen visibles en agenda" icon={<CalendarCheck2 className="size-5"/>}/><MetricCard label="Pendientes de acta" value={String(pendingMinutes)} detail="Requieren elaboración del acta" icon={<ClipboardPenLine className="size-5"/>}/></div>
    <form className="mb-5 grid min-w-0 gap-3 rounded-xl border bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="grid gap-1 text-xs font-medium xl:col-span-2">Buscar audiencia<Input name="q" defaultValue={query.q} placeholder="Radicado, título, tipo, participante, juez o ubicación…"/></label>
      <Filter label="Estado" name="status" value={query.status}><option value="">Todos los estados</option>{["programada","en_curso","realizada","aplazada","reprogramada","cancelada","pendiente_acta","acta_generada","archivada"].map((status)=><option key={status} value={status}>{statusLabel(status)}</option>)}</Filter>
      <Filter label="Alcance" name="scope" value={query.scope}><option value="">Todo mi alcance</option><option value="mine">Mis audiencias</option>{canViewDependency&&<option value="dependency">Mi despacho</option>}{canViewInstitution&&<option value="institution">Mi institución</option>}{canViewAll&&<option value="all">Todas</option>}</Filter>
      <Filter label="Despacho" name="dependency" value={query.dependency}><option value="">Todos los despachos</option>{depRows.map((dep)=><option key={dep.id} value={dep.id}>{dep.name}</option>)}</Filter>
      <Filter label="Institución" name="institution" value={query.institution}><option value="">Todas las instituciones</option>{depRows.filter((dep)=>!dep.parent_id).map((dep)=><option key={dep.id} value={dep.id}>{dep.name}</option>)}</Filter>
      <label className="grid gap-1 text-xs font-medium">Fecha desde<Input type="date" name="from" defaultValue={query.from}/></label><label className="grid gap-1 text-xs font-medium">Fecha hasta<Input type="date" name="to" defaultValue={query.to}/></label>
      <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-4"><Button type="submit"><Search className="size-4"/>Buscar y filtrar</Button><Button asChild variant="outline"><Link href="/admin/audiencias">Limpiar filtros</Link></Button><Badge variant="outline">{items.length} resultado{items.length===1?"":"s"}</Badge></div>
    </form>
    <HearingCalendar items={items}/>
    {!items.length&&<p className="mt-5 rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">No hay audiencias registradas.</p>}
  </>;
}

function toItem(row:HearingRow,names:Map<string,string>){let status=normalizeStatus(row.status,row.archived_at);if(status==="realizada")status=row.minute_id?(row.minute_status==="Borrador"?"pendiente_acta":"acta_generada"):"pendiente_acta";const participants=Array.isArray(row.participants)?row.participants.map((p)=>typeof p==="string"?p:(p as {name?:string}).name??"").join(" "):"";return {id:row.id,title:row.title,type:row.hearing_type,scheduledAt:row.scheduled_at,endAt:row.end_at,status,radicado:row.internal_number??"Sin expediente",caseTitle:row.ticket_name??row.case_title??"Sin expediente",dependency:row.dependency_name??"Sin despacho",dependencyId:row.dependency_id,judge:row.judge_is_owner?"Lilith D'Amico":row.judge_name??"Sin juez asignado",judgeId:row.assigned_judge_id,location:row.room||row.virtual_link||"Sin ubicación",minuteId:row.minute_id,participants,createdBy:row.created_by?names.get(row.created_by)??"Usuario interno":"Sistema",createdById:row.created_by} satisfies HearingCalendarItem&{caseTitle:string;dependencyId:string|null;judgeId:string|null;participants:string;createdBy:string;createdById:string|null};}
function normalizeStatus(value:string,archived:string|null){if(archived)return "archivada";const key=value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_");return ({programada:"programada",en_curso:"en_curso",realizada:"realizada",aplazada:"aplazada",reprogramada:"reprogramada",cancelada:"cancelada",pendiente_de_acta:"pendiente_acta",acta_generada:"acta_generada",archivada:"archivada"} as Record<string,string>)[key]??"programada";}
function isClosed(status:string){return ["realizada","pendiente_acta","acta_generada","cancelada","archivada"].includes(status);}
function descendants(root:string,children:Map<string,string[]>){const result=new Set<string>([root]);const queue=[root];while(queue.length){for(const child of children.get(queue.shift()!)??[]){if(!result.has(child)){result.add(child);queue.push(child);}}}return result;}
function Filter({label,name,value,children}:{label:string;name:string;value?:string;children:React.ReactNode}){return <label className="grid min-w-0 gap-1 text-xs font-medium">{label}<select name={name} defaultValue={value??""} className="h-9 min-w-0 rounded-md border bg-white px-3 text-sm font-normal">{children}</select></label>;}

async function loadHearingAgenda(
  supabase: Awaited<ReturnType<typeof requirePermission>>["supabase"],
  profile: Awaited<ReturnType<typeof requirePermission>>["profile"],
): Promise<SafeQueryResult<HearingRow>> {
  try {
    const result=await supabase.from("hearing_agenda_secure").select("*").order("scheduled_at",{ascending:false}).limit(500);
    if(!result.error)return {data:(result.data??[]) as HearingRow[]};
    logAdminDiagnostic("admin/audiencias","hearing_agenda_secure",result.error,profile);
    const fallback=await loadHearingAgendaFallback(supabase,profile);
    return {data:fallback.data,error:fallback.error??sanitizeError(result.error)};
  } catch (error) {
    const safe=sanitizeError(error);
    logAdminDiagnostic("admin/audiencias","hearing_agenda_secure",safe,profile);
    const fallback=await loadHearingAgendaFallback(supabase,profile);
    return {data:fallback.data,error:fallback.error??safe};
  }
}

async function loadHearingAgendaFallback(
  supabase: Awaited<ReturnType<typeof requirePermission>>["supabase"],
  profile: Awaited<ReturnType<typeof requirePermission>>["profile"],
): Promise<SafeQueryResult<HearingRow>> {
  const {data,error}=await supabase
    .from("hearings")
    .select("id,case_id,title,hearing_type,scheduled_at,end_at,room,virtual_link,status,is_public,participants,notes,created_by,archived_at,cases!inner(internal_number,judicial_number,title,ticket_name,chamber,authority_type,dependency_id,assigned_judge_id)")
    .order("scheduled_at",{ascending:false})
    .limit(500);
  if(error){
    logAdminDiagnostic("admin/audiencias","hearings_fallback",error,profile);
    return {data:[],error:sanitizeError(error)};
  }
  const rows=(data??[]) as unknown[];
  const hearingIds=rows.map((row)=>String((row as {id:string}).id));
  const caseRows=rows.map((row)=>firstRelation((row as {cases?:unknown}).cases));
  const dependencyIds=Array.from(new Set(caseRows.map((item)=>stringOrNull(item?.dependency_id)).filter(Boolean) as string[]));
  const judgeIds=Array.from(new Set(caseRows.map((item)=>stringOrNull(item?.assigned_judge_id)).filter(Boolean) as string[]));
  const [{data:minutes,error:minutesError},{data:dependencies,error:depsError},{data:judges,error:judgesError}]=await Promise.all([
    hearingIds.length?supabase.from("hearing_minutes").select("id,hearing_id,status,created_at").in("hearing_id",hearingIds).order("created_at",{ascending:false}):Promise.resolve({data:[],error:null}),
    dependencyIds.length?supabase.from("dependencies").select("id,name").in("id",dependencyIds):Promise.resolve({data:[],error:null}),
    judgeIds.length?supabase.from("profiles").select("id,full_name,is_owner").in("id",judgeIds):Promise.resolve({data:[],error:null}),
  ]);
  logAdminDiagnostic("admin/audiencias","hearing_minutes_fallback",minutesError,profile);
  logAdminDiagnostic("admin/audiencias","dependencies_fallback",depsError,profile);
  logAdminDiagnostic("admin/audiencias","judges_fallback",judgesError,profile);
  const minuteByHearing=new Map<string,{id:string;status:string}>();
  for(const minute of minutes??[])if(!minuteByHearing.has(minute.hearing_id))minuteByHearing.set(minute.hearing_id,minute);
  const dependencyById=new Map((dependencies??[]).map((item)=>[item.id,item.name]));
  const judgeById=new Map((judges??[]).map((item)=>[item.id,{name:item.is_owner?"Lilith D'Amico":item.full_name,isOwner:item.is_owner}]));
  return {data:rows.map((row):HearingRow=>{
    const hearing=row as Record<string,unknown>;
    const caseRow=firstRelation(hearing.cases);
    const minute=minuteByHearing.get(String(hearing.id));
    const dependencyId=stringOrNull(caseRow?.dependency_id);
    const judgeId=stringOrNull(caseRow?.assigned_judge_id);
    const judge=judgeId?judgeById.get(judgeId):null;
    return {
      id:String(hearing.id),
      case_id:String(hearing.case_id),
      title:String(hearing.title||"Audiencia sin título"),
      hearing_type:String(hearing.hearing_type||"Audiencia"),
      scheduled_at:String(hearing.scheduled_at||new Date(0).toISOString()),
      end_at:stringOrNull(hearing.end_at),
      room:stringOrNull(hearing.room),
      virtual_link:stringOrNull(hearing.virtual_link),
      status:String(hearing.status||"Programada"),
      participants:hearing.participants??[],
      created_by:stringOrNull(hearing.created_by),
      archived_at:stringOrNull(hearing.archived_at),
      internal_number:stringOrNull(caseRow?.internal_number),
      judicial_number:stringOrNull(caseRow?.judicial_number),
      case_title:stringOrNull(caseRow?.title),
      ticket_name:stringOrNull(caseRow?.ticket_name),
      dependency_id:dependencyId,
      assigned_judge_id:judgeId,
      dependency_name:dependencyId?dependencyById.get(dependencyId)??null:null,
      judge_name:judge?.name??null,
      judge_is_owner:judge?.isOwner??false,
      minute_id:minute?.id??null,
      minute_status:minute?.status??null,
    };
  })};
}

function firstRelation(value:unknown):Record<string,unknown>|null{if(Array.isArray(value))return (value[0] as Record<string,unknown>|undefined)??null;return value&&typeof value==="object"?value as Record<string,unknown>:null;}
function stringOrNull(value:unknown){return typeof value==="string"&&value.length?value:null;}
function sanitizeError(error:unknown):SafeError{if(error&&typeof error==="object"){const source=error as Record<string,unknown>;return {code:stringOrNull(source.code)??undefined,message:stringOrNull(source.message)??undefined,details:stringOrNull(source.details)??undefined,hint:stringOrNull(source.hint)??undefined};}return {message:error instanceof Error?error.message:"Error desconocido"};}
function logAdminDiagnostic(route:string,queryName:string,error:unknown,profile:{id:string;role:string;is_owner:boolean}|null){if(!error||process.env.NODE_ENV==="production")return;const safe=sanitizeError(error);console.error("Admin route diagnostic",{route,queryName,code:safe.code,message:safe.message,userId:profile?.id,role:profile?.role,isOwner:profile?.is_owner});}
