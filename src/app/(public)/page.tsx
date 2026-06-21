import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, FileSearch, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";

const services = [
  { title: "Consulta de expedientes", description: "Consulte el estado y las actuaciones públicas usando el número de radicado.", href: "/consulta", icon: FileSearch },
  { title: "Comunicados", description: "Información institucional, avisos públicos y novedades de la plataforma.", href: "/comunicados", icon: Megaphone },
  { title: "Audiencias públicas", description: "Agenda de sesiones abiertas programadas por salas y despachos.", href: "/audiencias", icon: CalendarDays },
];

export default async function HomePage() {
  const supabase = await createClient();
  const [caseResult, hearingCount, proceedingCount, noticeCount, noticeResult, hearingResult] = supabase
    ? await Promise.all([
        supabase.from("public_case_lookup").select("id", { count: "exact", head: true }),
        supabase.from("public_hearings").select("id", { count: "exact", head: true }),
        supabase.from("public_proceedings").select("id", { count: "exact", head: true }),
        supabase.from("public_notices").select("id", { count: "exact", head: true }).eq("status", "Publicado"),
        supabase.from("public_notices").select("slug,title,category,published_at").eq("status", "Publicado").order("published_at", { ascending: false }).limit(3),
        supabase.from("public_hearings").select("id,title,scheduled_at,room,chamber,internal_number").gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(3),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { data: [] }, { data: [] }];

  const stats = [
    [String(caseResult.count ?? 0), "Expedientes públicos"],
    [String(hearingCount.count ?? 0), "Audiencias programadas"],
    [String(proceedingCount.count ?? 0), "Providencias publicadas"],
    [String(noticeCount.count ?? 0), "Comunicados emitidos"],
  ];
  const notices = (noticeResult.data ?? []).map((notice) => ({ ...notice, date: notice.published_at }));
  const hearings = (hearingResult.data ?? []).map((hearing) => ({
    ...hearing,
    date: new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(new Date(hearing.scheduled_at)),
    time: new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" }).format(new Date(hearing.scheduled_at)),
    court: hearing.chamber,
    caseNumber: hearing.internal_number,
  }));

  return <>
    <section className="relative overflow-hidden bg-[#102d49] text-white institutional-grid">
      <div className="absolute -right-20 top-[-60px] size-[420px] rounded-full border border-white/5" />
      <div className="absolute -right-2 top-14 size-[250px] rounded-full border border-[#c4a35a]/10" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.25fr_.75fr] lg:px-8 lg:py-28">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.28em] text-[#d1b56f]">Palacio Judicial · República de Colombia</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.55rem]">Sistema Integral de<br /><span className="text-[#dfc985]">Gestión Judicial</span></h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Plataforma unificada para la radicación, el trámite y la consulta de actuaciones judiciales.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-[#b38a3c] text-white hover:bg-[#9c762e]"><Link href="/consulta">Consultar expediente <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link href="/login">Acceso institucional</Link></Button>
          </div>
        </div>
        <div className="hidden items-center justify-center lg:flex">
          <div className="relative grid size-72 place-items-center rounded-full border border-white/10">
            <div className="relative size-48 overflow-hidden rounded-full border border-white/20 bg-white p-3 shadow-2xl"><Image src="/escudo-institucional.png" alt="Escudo institucional de Colombia" fill sizes="192px" className="object-contain p-2" priority /></div>
            <span className="absolute bottom-5 text-[9px] uppercase tracking-[.3em] text-slate-400">Justicia · Servicio · Transparencia</span>
          </div>
        </div>
      </div>
    </section>

    <section className="border-b bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
        {stats.map(([value, label], index) => <div key={label} className={`py-7 text-center lg:py-8 ${index > 0 ? "border-l" : ""}`}><p className="mono-number text-2xl font-semibold text-[#153b5c] sm:text-3xl">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9b762f]">Servicios a la ciudadanía</p><h2 className="mt-3 text-3xl font-semibold text-[#102d49]">Información judicial en un solo lugar</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Acceda a la información pública de expedientes, audiencias y decisiones judiciales.</p></div>
      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {services.map(({ title, description, href, icon: Icon }) => <Link key={href} href={href} className="group"><Card className="h-full rounded-md border-t-2 border-t-transparent py-0 transition hover:-translate-y-1 hover:border-t-[#b38a3c] hover:shadow-lg"><CardContent className="p-6"><div className="grid size-11 place-items-center rounded bg-[#edf2f6] text-[#183d61] group-hover:bg-[#183d61] group-hover:text-white"><Icon className="size-5" /></div><h3 className="mt-5 font-semibold text-[#153553]">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><span className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#9a752f]">Ir al servicio <ArrowRight className="size-3.5 transition group-hover:translate-x-1" /></span></CardContent></Card></Link>)}
      </div>
    </section>

    <section className="bg-[#edf1f4]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9b762f]">Información institucional</p><h2 className="mt-2 text-2xl font-semibold text-[#102d49]">Comunicados recientes</h2></div><Link href="/comunicados" className="text-xs font-semibold text-[#183d61]">Ver todos</Link></div><div className="mt-6 divide-y rounded-md border bg-white px-5">{notices.map((notice) => <Link key={notice.slug} href={`/comunicados/${notice.slug}`} className="block py-5"><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#9b762f]"><span>{notice.category}</span><span className="text-slate-300">·</span><time className="text-slate-500">{formatDate(notice.date)}</time></div><h3 className="mt-2 text-sm font-semibold leading-5 text-[#153553] hover:underline">{notice.title}</h3></Link>)}</div></div>
        <div><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9b762f]">Agenda judicial</p><h2 className="mt-2 text-2xl font-semibold text-[#102d49]">Próximas audiencias</h2></div><Link href="/audiencias" className="text-xs font-semibold text-[#183d61]">Agenda completa</Link></div><div className="mt-6 divide-y rounded-md border bg-white px-5">{hearings.slice(0, 3).map((hearing) => <div key={hearing.id} className="flex gap-4 py-4"><div className="w-14 shrink-0 rounded bg-[#153b5c] p-2 text-center text-white"><p className="text-[10px] font-semibold">{hearing.date}</p><p className="mono-number mt-1 text-xs text-[#e4ca8c]">{hearing.time}</p></div><div><h3 className="text-sm font-semibold text-[#153553]">{hearing.title}</h3><p className="mt-1 text-xs text-muted-foreground">{hearing.court} · {hearing.room}</p><p className="mono-number mt-1 text-[11px] text-slate-500">{hearing.caseNumber}</p></div></div>)}</div></div>
      </div>
    </section>
  </>;
}
