import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  FileCheck2,
  FileSearch,
  Gavel,
  Megaphone,
  Scale,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { applications, cases, formatDate, hearings, notices, ROLEPLAY_NOTICE, warrants, workAreas } from "@/lib/demo-data";

const actionCenter = [
  { title: "Consultar expedientes", description: "Revise expedientes públicos mediante número de docket.", href: "/consulta", icon: FileSearch },
  { title: "Ver providencias", description: "Decisiones ficticias publicadas para consulta comunitaria.", href: "/providencias", icon: FileCheck2 },
  { title: "Revisar audiencias", description: "Agenda pública de sesiones narrativas y audiencias.", href: "/audiencias", icon: CalendarDays },
  { title: "Postularse a juez", description: "Convocatorias para cargos judiciales de roleplay.", href: "/postulaciones", icon: Scale },
  { title: "Registrarse como abogado", description: "Solicitud para litigar en expedientes de la comunidad.", href: "/postulaciones", icon: BriefcaseBusiness },
  { title: "Consultar comunicados", description: "Noticias, directivas y avisos del Departamento RP.", href: "/comunicados", icon: Megaphone },
  { title: "Acceso del personal", description: "Ingreso exclusivo para cuentas creadas por el OWNER.", href: "/login", icon: UserRoundCheck },
];

const stats = [
  ["1.248", "Expedientes roleplay activos"],
  ["36", "Audiencias programadas"],
  ["487", "Documentos publicados"],
  ["19", "Warrants ficticios activos"],
];

export default function HomePage() {
  const publicCases = cases.filter((item) => item.publicVisibility).slice(0, 3);
  const publicWarrants = warrants.filter((item) => item.public).slice(0, 2);

  return (
    <>
      <section className="relative overflow-hidden bg-[#08233d] text-white institutional-grid">
        <div className="absolute -right-28 top-[-90px] size-[520px] rounded-full border border-white/5" />
        <div className="absolute -right-4 top-24 size-[300px] rounded-full border border-[#c4a35a]/10" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.12fr_.88fr] lg:px-8">
          <div className="reveal">
            <div className="mb-6 inline-flex items-center gap-2 rounded-sm border border-amber-300/40 bg-amber-200/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.15em] text-amber-100">
              <ShieldAlert className="size-3.5" /> {ROLEPLAY_NOTICE}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[.28em] text-[#d1b56f]">
              Department of Justice · Roleplay Portal
            </p>
            <h1 className="mt-4 max-w-4xl font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.7rem]">
              Justicia ficticia, expedientes y operaciones institucionales para una comunidad de roleplay.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Portal completo para administrar comunicados, expedientes, audiencias, providencias, postulaciones
              y warrants narrativos sin producir efectos legales reales.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-[#b38a3c] text-white hover:bg-[#9c762e]">
                <Link href="/consulta">Consultar expediente <ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Link href="/login">Iniciar sesión</Link>
              </Button>
            </div>
          </div>
          <div className="reveal hidden items-center justify-center lg:flex">
            <div className="relative rounded-[2rem] border border-white/10 bg-white/[.035] p-10 shadow-2xl">
              <div className="rounded-full bg-white p-6 shadow-xl">
                <Image src="/department-seal.png" alt="Sello Department of Justice Roleplay" width={310} height={310} className="h-auto w-[310px]" priority />
              </div>
              <p className="mt-6 text-center text-[10px] font-semibold uppercase tracking-[.28em] text-slate-300">
                Fictional Roleplay Jurisdiction
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {stats.map(([value, label], i) => (
            <div key={label} className={`reveal py-7 text-center lg:py-8 ${i > 0 ? "lg:border-l" : ""}`}>
              <p className="mono-number stat-count text-2xl font-semibold text-[#153b5c] sm:text-3xl">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="centro-acciones" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeading eyebrow="Centro de acciones" title="Servicios principales para visitantes y personal" description="Accesos directos a los flujos más usados del Departamento de Justicia Roleplay." />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actionCenter.map(({ title, description, href, icon: Icon }) => (
            <Link key={title} href={href} className="group reveal">
              <Card className="interactive-card h-full rounded-md border-t-2 border-t-transparent py-0 transition">
                <CardContent className="p-6">
                  <div className="grid size-11 place-items-center rounded bg-[#edf2f6] text-[#183d61] transition group-hover:bg-[#183d61] group-hover:text-white">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 font-serif font-semibold text-[#153553]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                  <span className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#9a752f]">
                    Abrir servicio <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-[#edf1f4]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_.9fr] lg:px-8">
          <div className="reveal">
            <div className="flex items-end justify-between gap-4">
              <SectionHeading eyebrow="Comunicados" title="Noticias recientes" />
              <Link href="/comunicados" className="text-xs font-semibold text-[#183d61]">Ver todos</Link>
            </div>
            <div className="mt-6 divide-y rounded-md border bg-white px-5">
              {notices.map((notice) => (
                <Link key={notice.slug} href={`/comunicados/${notice.slug}`} className="block py-5 transition hover:bg-slate-50">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#9b762f]">
                    <span>{notice.category}</span><span className="text-slate-300">·</span><time className="text-slate-500">{formatDate(notice.date)}</time>
                  </div>
                  <h3 className="mt-2 font-serif text-base font-semibold leading-5 text-[#153553]">{notice.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{notice.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
          <div className="reveal rounded-2xl border bg-white p-6">
            <SectionHeading eyebrow="Misión institucional" title="Servicio narrativo, transparencia y control" description="El Departamento organiza procesos ficticios, protege información reservada del roleplay y ofrece consulta pública limitada para mantener claridad entre ficción y realidad." />
            <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-700">
              {["Integridad narrativa y trazabilidad de acciones.", "Separación visible frente al DOJ real.", "Permisos de servidor para proteger rutas internas.", "Documentos descargables con marcas de roleplay."].map((item) => (
                <li key={item} className="flex gap-3"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-[#9a752f]" /> {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Nuestro trabajo" title="Áreas de trabajo" description="Divisiones ficticias inspiradas en una estructura institucional, adaptadas al universo de roleplay." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {workAreas.map((area) => (
            <article key={area.title} className="reveal interactive-card rounded-xl border bg-white p-5">
              <Scale className="size-6 text-[#9a752f]" />
              <h3 className="mt-4 font-serif font-semibold text-[#153553]">{area.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{area.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-3 lg:px-8">
          <Panel title="Expedientes públicos recientes" href="/expedientes-publicos">
            {publicCases.map((item) => (
              <Link key={item.id} href="/consulta" className="block rounded border p-4 transition hover:bg-slate-50">
                <p className="mono-number text-xs font-semibold text-[#153553]">{item.internalNumber}</p>
                <p className="mt-2 text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.status} · {formatDate(item.filedAt)}</p>
              </Link>
            ))}
          </Panel>
          <Panel title="Próximas audiencias públicas" href="/audiencias">
            {hearings.slice(0, 3).map((hearing) => (
              <div key={hearing.id} className="flex gap-4 rounded border p-4">
                <div className="w-14 shrink-0 rounded bg-[#153b5c] p-2 text-center text-white">
                  <p className="text-[10px] font-semibold">{hearing.date}</p>
                  <p className="mono-number mt-1 text-xs text-[#e4ca8c]">{hearing.time}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#153553]">{hearing.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{hearing.court} · {hearing.room}</p>
                </div>
              </div>
            ))}
          </Panel>
          <Panel title="Warrants públicos roleplay" href="/warrants">
            {publicWarrants.map((warrant) => (
              <article key={warrant.id} className="rounded border border-amber-200 bg-amber-50 p-4">
                <p className="mono-number text-xs font-semibold text-amber-950">{warrant.number}</p>
                <p className="mt-2 text-sm font-medium text-[#153553]">{warrant.type}</p>
                <p className="mt-1 text-xs text-amber-900">{warrant.status} · vence {formatDate(warrant.expires)}</p>
              </article>
            ))}
            <p className="text-xs leading-5 text-muted-foreground">Toda orden exportada debe mostrar: ROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.</p>
          </Panel>
        </div>
      </section>

      <section className="bg-[#0b2238] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.7fr_1.3fr] lg:px-8">
          <div className="reveal rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#d1b56f]">Attorney General</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold">Avery Caldwell</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Personaje ficticio responsable de coordinar política interna, permisos y publicaciones del Departamento Roleplay.
            </p>
          </div>
          <div className="reveal">
            <SectionHeading eyebrow="Postulaciones abiertas" title="Ciclo de selección del Departamento" description="Convocatorias para jueces, abogados e investigadores dentro de la comunidad." inverse />
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {applications.map((application) => (
                <Link key={application.id} href="/postulaciones" className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:bg-white/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#d1b56f]">{application.status}</p>
                  <h3 className="mt-2 font-serif font-semibold">{application.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{application.vacancies} vacantes · cierre {formatDate(application.closes)}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-7xl gap-4 px-4 py-7 sm:px-6 lg:px-8">
          <Gavel className="mt-0.5 size-5 shrink-0 text-amber-800" />
          <div>
            <h2 className="text-sm font-semibold text-amber-950">Aviso permanente de roleplay</h2>
            <p className="mt-1 text-sm leading-6 text-amber-900/80">
              {ROLEPLAY_NOTICE} Ningún expediente, warrant, providencia, cargo o documento de este portal tiene validez jurídica real.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  inverse = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  inverse?: boolean;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9b762f]">{eyebrow}</p>
      <h2 className={`mt-3 font-serif text-3xl font-semibold ${inverse ? "text-white" : "text-[#102d49]"}`}>{title}</h2>
      {description && <p className={`mt-3 text-sm leading-6 ${inverse ? "text-slate-300" : "text-muted-foreground"}`}>{description}</p>}
    </div>
  );
}

function Panel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="reveal rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-[#102d49]">{title}</h2>
        <Link href={href} className="text-xs font-semibold text-[#8c6929]">Ver más</Link>
      </div>
      <div className="mt-5 grid gap-3">{children}</div>
    </section>
  );
}
