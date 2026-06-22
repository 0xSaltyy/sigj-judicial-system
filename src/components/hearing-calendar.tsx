"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HearingCalendarItem = {
  id:string; title:string; type:string; scheduledAt:string; endAt:string|null; status:string;
  radicado:string; dependency:string; judge:string; location:string; minuteId:string|null;
};

const weekdays=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const statusColors:Record<string,string>={
  programada:"border-blue-200 bg-blue-50 text-blue-800", en_curso:"border-amber-200 bg-amber-50 text-amber-900",
  realizada:"border-slate-200 bg-slate-100 text-slate-700", aplazada:"border-orange-200 bg-orange-50 text-orange-800",
  reprogramada:"border-indigo-200 bg-indigo-50 text-indigo-800", cancelada:"border-red-200 bg-red-50 text-red-800",
  pendiente_acta:"border-amber-200 bg-amber-50 text-amber-900", acta_generada:"border-emerald-200 bg-emerald-50 text-emerald-800",
  archivada:"border-slate-300 bg-slate-100 text-slate-600",
};

export function HearingCalendar({items}:{items:HearingCalendarItem[]}) {
  const [cursor,setCursor]=useState(()=>{const first=items.find((item)=>new Date(item.scheduledAt)>=startOfToday());return first?new Date(first.scheduledAt):new Date();});
  const [view,setView]=useState<"month"|"agenda">("month");
  const monthStart=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const gridStart=new Date(monthStart);gridStart.setDate(1-((monthStart.getDay()+6)%7));
  const days=Array.from({length:42},(_,index)=>{const day=new Date(gridStart);day.setDate(gridStart.getDate()+index);return day;});
  const byDay=useMemo(()=>{const map=new Map<string,HearingCalendarItem[]>();for(const item of items){const key=dayKey(new Date(item.scheduledAt));map.set(key,[...(map.get(key)??[]),item]);}return map;},[items]);
  const visibleAgenda=items.filter((item)=>{const date=new Date(item.scheduledAt);return date.getFullYear()===cursor.getFullYear()&&date.getMonth()===cursor.getMonth();});
  return <section className="min-w-0 overflow-hidden rounded-xl border bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2"><CalendarDays className="size-5 text-[#9a752f]"/><h2 className="font-semibold text-[#153553] capitalize">{new Intl.DateTimeFormat("es-CO",{month:"long",year:"numeric"}).format(cursor)}</h2></div>
      <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()-1,1))} aria-label="Mes anterior"><ChevronLeft className="size-4"/></Button><Button type="button" size="sm" variant="outline" onClick={()=>setCursor(new Date())}>Hoy</Button><Button type="button" size="sm" variant="outline" onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()+1,1))} aria-label="Mes siguiente"><ChevronRight className="size-4"/></Button><Button type="button" size="sm" variant={view==="month"?"default":"outline"} onClick={()=>setView("month")}>Mes</Button><Button type="button" size="sm" variant={view==="agenda"?"default":"outline"} onClick={()=>setView("agenda")}>Agenda</Button></div>
    </div>
    {view==="month"?<div className="overflow-x-auto"><div className="min-w-[760px]"><div className="grid grid-cols-7 border-b bg-slate-50">{weekdays.map((day)=><div key={day} className="p-2 text-center text-xs font-semibold text-slate-600">{day}</div>)}</div><div className="grid grid-cols-7">{days.map((day)=>{const current=day.getMonth()===cursor.getMonth();const dayItems=byDay.get(dayKey(day))??[];return <div key={day.toISOString()} className={cn("min-h-32 border-b border-r p-2",!current&&"bg-slate-50/70 text-slate-400",dayKey(day)===dayKey(new Date())&&"bg-amber-50/50")}><p className="mb-2 text-xs font-semibold">{day.getDate()}</p><div className="space-y-1">{dayItems.slice(0,3).map((item)=><Link key={item.id} href={`/admin/audiencias/${item.id}`} className={cn("block min-w-0 rounded border px-2 py-1 text-[10px] leading-4 transition hover:shadow-sm",statusColors[item.status]??statusColors.programada)}><span className="block truncate font-semibold">{time(item.scheduledAt)} · {item.type}</span><span className="block truncate">{item.radicado}</span></Link>)}{dayItems.length>3&&<p className="text-[10px] text-muted-foreground">+{dayItems.length-3} audiencias</p>}</div></div>})}</div></div></div>:<div className="divide-y">{visibleAgenda.map((item)=><HearingAgendaRow key={item.id} item={item}/>)}{!visibleAgenda.length&&<p className="p-10 text-center text-sm text-muted-foreground">No hay audiencias en este mes con los filtros actuales.</p>}</div>}
  </section>;
}

function HearingAgendaRow({item}:{item:HearingCalendarItem}){return <Link href={`/admin/audiencias/${item.id}`} className="flex min-w-0 flex-col gap-3 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center"><div className="w-24 shrink-0"><p className="text-xs font-semibold text-[#153553]">{new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"short"}).format(new Date(item.scheduledAt))}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3"/>{time(item.scheduledAt)}</p></div><div className="min-w-0 flex-1"><p className="break-words font-semibold text-[#153553]">{item.title}</p><p className="mt-1 break-words text-xs text-muted-foreground">{item.radicado} · {item.dependency} · {item.judge}</p><p className="mt-1 flex items-center gap-1 break-words text-xs text-muted-foreground"><MapPin className="size-3 shrink-0"/>{item.location}</p></div><Badge variant="outline" className={statusColors[item.status]}>{statusLabel(item.status)}</Badge></Link>}
export function statusLabel(status:string){return ({programada:"Programada",en_curso:"En curso",realizada:"Realizada",aplazada:"Aplazada",reprogramada:"Reprogramada",cancelada:"Cancelada",pendiente_acta:"Pendiente de acta",acta_generada:"Acta generada",archivada:"Archivada"} as Record<string,string>)[status]??status;}
function dayKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
function time(value:string){return new Intl.DateTimeFormat("es-CO",{hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
function startOfToday(){const date=new Date();date.setHours(0,0,0,0);return date;}
