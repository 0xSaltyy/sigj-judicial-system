import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  FileCheck2,
  FileSearch,
  Megaphone,
  Scale,
  Search,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { applications, cases, formatDate, hearings, notices, warrants, workAreas } from "@/lib/demo-data";

const actionCenter = [
  { title: "Consultar expedientes", href: "/consulta", icon: FileSearch },
  { title: "Ver providencias", href: "/providencias", icon: FileCheck2 },
  { title: "Revisar audiencias", href: "/audiencias", icon: CalendarDays },
  { title: "Postularse a juez", href: "/postulaciones", icon: Scale },
  { title: "Registrarse como abogado", href: "/postulaciones", icon: BriefcaseBusiness },
  { title: "Consultar comunicados", href: "/comunicados", icon: Megaphone },
  { title: "Acceso del personal", href: "/login", icon: UserRoundCheck },
];

const stats = [
  ["1,248", "Expedientes activos"],
  ["36", "Audiencias programadas"],
  ["487", "Documentos publicados"],
  ["19", "Órdenes activas"],
];

export default function HomePage() {
  const publicCases = cases.filter((item) => item.publicVisibility).slice(0, 3);
  const publicWarrants = warrants.filter((item) => item.public).slice(0, 2);
  const featured = notices[0];

  return (
    <>
      <section className="border-b bg-white">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-14">
          <div className="reveal">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#b21b1b]">Featured</p>
            <h1 className="mt-3 max-w-4xl font-serif text-4xl font-semibold leading-tight text-[#112f4e] sm:text-5xl">
              {featured.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700">{featured.excerpt}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button asChild className="rounded-none bg-[#005ea8] hover:bg-[#1a4480]">
                <Link href={`/comunicados/${featured.slug}`}>Leer comunicado <ArrowRight className="size-4" /></Link>
              </Button>
              <Link href="/consulta" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005ea8] hover:underline">
                Consultar expediente <Search className="size-4" />
              </Link>
            </div>
          </div>
          <aside className="reveal border-l-4 border-[#b21b1b] bg-[#f5f7f9] p-6">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#5b7287]">Attorney General</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-[#112f4e]">Pam Bondi</h2>
            <p className="mt-1 text-sm font-semibold text-slate-700">Attorney General</p>
            <p className="mt-5 text-sm leading-7 text-slate-700">
              La oficina coordina la publicación de comunicados, la consulta de expedientes, la agenda pública y los servicios del personal autorizado.
            </p>
          </aside>
        </div>
      </section>

      <section id="centro-acciones" className="border-y bg-[#f5f7f9]">
        <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Action Center" title="Centro de acciones" />
          <div className="mt-8 grid gap-px border bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {actionCenter.map(({ title, href, icon: Icon }) => (
              <Link key={title} href={href} className="group reveal bg-white p-6 transition hover:bg-[#edf5fb]">
                <Icon className="size-8 text-[#005ea8]" />
                <h3 className="mt-5 font-serif text-lg font-semibold leading-6 text-[#112f4e]">{title}</h3>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#005ea8]">
                  Abrir <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
          <div className="reveal">
            <SectionHeading eyebrow="Our Mission" title="Nuestra misión" />
          </div>
          <div className="reveal">
            <p className="font-serif text-2xl leading-10 text-[#112f4e]">
              Defender la integridad de los procesos del Departamento, mantener segura la información interna y ofrecer servicios públicos claros para consulta, audiencias, comunicaciones y registros.
            </p>
            <div className="mt-8 grid gap-5 border-t pt-7 md:grid-cols-2">
              {["Independencia e imparcialidad", "Honestidad e integridad", "Respeto", "Excelencia operativa"].map((value) => (
                <div key={value}>
                  <h3 className="font-serif text-lg font-semibold text-[#112f4e]">{value}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">Guía para la administración de expedientes, comunicaciones y servicios institucionales.</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-[#112f4e] text-white">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {stats.map(([value, label], i) => (
            <div key={label} className={`reveal py-8 text-center ${i > 0 ? "lg:border-l lg:border-white/15" : ""}`}>
              <p className="mono-number stat-count text-3xl font-semibold sm:text-4xl">{value}</p>
              <p className="mt-2 text-xs uppercase tracking-[.12em] text-slate-300">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Our Work" title="Áreas de trabajo" />
          <div className="mt-8 grid gap-px border bg-slate-200 md:grid-cols-2">
            {workAreas.map((area) => (
              <article key={area.title} className="reveal bg-white p-6">
                <Scale className="size-7 text-[#005ea8]" />
                <h3 className="mt-4 font-serif text-xl font-semibold text-[#112f4e]">{area.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-700">{area.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f5f7f9]">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_.8fr] lg:px-8">
          <div className="reveal">
            <div className="flex items-end justify-between gap-4">
              <SectionHeading eyebrow="News" title="Comunicados recientes" />
              <Link href="/comunicados" className="text-sm font-semibold text-[#005ea8] hover:underline">Más comunicados</Link>
            </div>
            <div className="mt-6 divide-y border bg-white">
              {notices.map((notice) => (
                <Link key={notice.slug} href={`/comunicados/${notice.slug}`} className="block p-5 transition hover:bg-[#edf5fb]">
                  <div className="text-xs font-semibold uppercase tracking-[.12em] text-[#b21b1b]">{notice.category}</div>
                  <h3 className="mt-2 font-serif text-xl font-semibold leading-7 text-[#112f4e]">{notice.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{notice.excerpt}</p>
                  <time className="mt-3 block text-xs text-slate-500">{formatDate(notice.date)}</time>
                </Link>
              ))}
            </div>
          </div>
          <div className="reveal">
            <SectionHeading eyebrow="Applications" title="Convocatorias abiertas" />
            <div className="mt-6 divide-y border bg-white">
              {applications.map((application) => (
                <Link key={application.id} href="/postulaciones" className="block p-5 transition hover:bg-[#edf5fb]">
                  <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#5b7287]">{application.status}</p>
                  <h3 className="mt-2 font-serif text-lg font-semibold text-[#112f4e]">{application.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{application.vacancies} vacantes · cierre {formatDate(application.closes)}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
          <Panel title="Expedientes públicos" href="/expedientes-publicos">
            {publicCases.map((item) => (
              <Link key={item.id} href="/consulta" className="block border-b py-4 last:border-0">
                <p className="mono-number text-xs font-semibold text-[#005ea8]">{item.internalNumber}</p>
                <p className="mt-2 text-sm font-semibold text-[#112f4e]">{item.title}</p>
                <p className="mt-1 text-xs text-slate-600">{item.status} · {formatDate(item.filedAt)}</p>
              </Link>
            ))}
          </Panel>
          <Panel title="Audiencias públicas" href="/audiencias">
            {hearings.slice(0, 3).map((hearing) => (
              <div key={hearing.id} className="border-b py-4 last:border-0">
                <p className="mono-number text-xs font-semibold text-[#005ea8]">{hearing.date} · {hearing.time}</p>
                <h3 className="mt-2 text-sm font-semibold text-[#112f4e]">{hearing.title}</h3>
                <p className="mt-1 text-xs text-slate-600">{hearing.court} · {hearing.room}</p>
              </div>
            ))}
          </Panel>
          <Panel title="Órdenes públicas" href="/warrants">
            {publicWarrants.map((warrant) => (
              <article key={warrant.id} className="border-b py-4 last:border-0">
                <p className="mono-number text-xs font-semibold text-[#005ea8]">{warrant.number}</p>
                <p className="mt-2 text-sm font-semibold text-[#112f4e]">{warrant.type}</p>
                <p className="mt-1 text-xs text-slate-600">{warrant.status} · vence {formatDate(warrant.expires)}</p>
              </article>
            ))}
          </Panel>
        </div>
      </section>
    </>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="border-l-4 border-[#b21b1b] pl-3 text-xs font-semibold uppercase tracking-[.16em] text-[#5b7287]">{eyebrow}</p>
      <h2 className="mt-3 font-serif text-3xl font-semibold text-[#112f4e]">{title}</h2>
    </div>
  );
}

function Panel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="reveal border bg-white p-5">
      <div className="flex items-center justify-between gap-3 border-b pb-4">
        <h2 className="font-serif text-xl font-semibold text-[#112f4e]">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-[#005ea8] hover:underline">Ver más</Link>
      </div>
      <div>{children}</div>
    </section>
  );
}
