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
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/display";

const actionCenter = [
  { title: "Consultar expedientes", href: "/consulta", icon: FileSearch },
  { title: "Ver providencias", href: "/providencias", icon: FileCheck2 },
  { title: "Revisar audiencias", href: "/audiencias", icon: CalendarDays },
  { title: "Postularse a juez", href: "/postulaciones", icon: Scale },
  { title: "Registrarse como abogado", href: "/postulaciones", icon: BriefcaseBusiness },
  { title: "Realizar una denuncia", href: "/denuncias/nueva", icon: ShieldAlert },
  { title: "Consultar comunicados", href: "/comunicados", icon: Megaphone },
  { title: "Acceso del personal", href: "/login", icon: UserRoundCheck },
];

const workAreas = [
  ["División Criminal", "Investigaciones, warrants de roleplay y coordinación con fiscales autorizados."],
  ["División Civil", "Gestión de expedientes públicos, audiencias y actuaciones administrativas."],
  ["Oficina de Comunicaciones", "Comunicados, recursos públicos y anuncios institucionales del roleplay."],
  ["Registros y Tecnología", "Custodia de documentos, auditoría y servicios de consulta pública."],
];

type Notice = { id: string; title: string; slug: string; category: string; content_markdown: string; published_at: string | null };
type PublicCase = { id: string; internal_number: string; title: string; status: string; filed_at: string };
type PublicHearing = { id: string; title: string; scheduled_at: string; room: string; status: string };
type PublicWarrant = { id: string; warrant_number: string; warrant_type: string; status: string; expires_at: string | null };

export default async function HomePage() {
  const supabase = await createClient();
  const [
    noticesResult,
    casesResult,
    hearingsResult,
    warrantsResult,
    casesCount,
    hearingsCount,
    proceedingsCount,
    warrantsCount,
  ] = supabase ? await Promise.all([
    supabase.from("public_notices").select("id,title,slug,category,content_markdown,published_at").eq("status", "Publicado").is("archived_at", null).order("published_at", { ascending: false }).limit(4),
    supabase.from("cases").select("id,internal_number,title,status,filed_at").eq("public_visibility", true).eq("confidentiality_level", "Público").is("archived_at", null).order("filed_at", { ascending: false }).limit(3),
    supabase.from("hearings").select("id,title,scheduled_at,room,status").eq("is_public", true).is("archived_at", null).gte("scheduled_at", new Date().toISOString()).order("scheduled_at", { ascending: true }).limit(3),
    supabase.from("roleplay_warrants").select("id,warrant_number,warrant_type,status,expires_at").eq("confidentiality", "public").in("status", ["Aprobada", "Activa", "Ejecutada", "Vencida"]).is("archived_at", null).order("created_at", { ascending: false }).limit(2),
    supabase.from("cases").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("hearings").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("proceedings").select("id", { count: "exact", head: true }).eq("visibility", "public").eq("status", "Publicado").is("archived_at", null),
    supabase.from("roleplay_warrants").select("id", { count: "exact", head: true }).in("status", ["Aprobada", "Activa"]).is("archived_at", null),
  ]) : [];
  const notices = (noticesResult?.data ?? []) as Notice[];
  const publicCases = (casesResult?.data ?? []) as PublicCase[];
  const publicHearings = (hearingsResult?.data ?? []) as PublicHearing[];
  const publicWarrants = (warrantsResult?.data ?? []) as PublicWarrant[];
  const featured = notices[0];
  const stats = [
    [String(casesCount?.count ?? 0), "Expedientes activos"],
    [String(hearingsCount?.count ?? 0), "Audiencias programadas"],
    [String(proceedingsCount?.count ?? 0), "Documentos publicados"],
    [String(warrantsCount?.count ?? 0), "Órdenes activas"],
  ];

  return (
    <>
      <section className="border-b bg-white">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-14">
          <div className="reveal">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#b21b1b]">Featured</p>
            <h1 className="mt-3 max-w-4xl font-serif text-4xl font-semibold leading-tight text-[#112f4e] sm:text-5xl">
              {featured?.title ?? "Department of Justice Roleplay"}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700">{featured ? excerpt(featured.content_markdown) : "Portal público para comunicados, expedientes, audiencias, warrants, postulaciones y denuncias del entorno de roleplay."}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button asChild className="rounded-none bg-[#005ea8] hover:bg-[#1a4480]">
                <Link href={featured ? `/comunicados/${featured.slug}` : "/comunicados"}>{featured ? "Leer comunicado" : "Ver comunicados"} <ArrowRight className="size-4" /></Link>
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
            {workAreas.map(([title, description]) => (
              <article key={title} className="reveal bg-white p-6">
                <Scale className="size-7 text-[#005ea8]" />
                <h3 className="mt-4 font-serif text-xl font-semibold text-[#112f4e]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-700">{description}</p>
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
              {notices.length === 0 ? <EmptyLine text="No hay comunicados publicados por el momento." /> : null}
              {notices.map((notice) => (
                <Link key={notice.slug} href={`/comunicados/${notice.slug}`} className="block p-5 transition hover:bg-[#edf5fb]">
                  <div className="text-xs font-semibold uppercase tracking-[.12em] text-[#b21b1b]">{notice.category}</div>
                  <h3 className="mt-2 font-serif text-xl font-semibold leading-7 text-[#112f4e]">{notice.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{excerpt(notice.content_markdown)}</p>
                  <time className="mt-3 block text-xs text-slate-500">{formatDate(notice.published_at)}</time>
                </Link>
              ))}
            </div>
          </div>
          <div className="reveal">
            <SectionHeading eyebrow="Applications" title="Convocatorias abiertas" />
            <div className="mt-6 divide-y border bg-white">
              <EmptyLine text="No hay convocatorias abiertas en este momento." />
              <Link href="/postulaciones" className="block p-5 text-sm font-semibold text-[#005ea8] hover:bg-[#edf5fb]">Ver convocatorias y estado de postulación</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
          <Panel title="Expedientes públicos" href="/expedientes-publicos">
            {publicCases.map((item) => (
              <Link key={item.id} href="/consulta" className="block border-b py-4 last:border-0">
                <p className="mono-number text-xs font-semibold text-[#005ea8]">{item.internal_number}</p>
                <p className="mt-2 text-sm font-semibold text-[#112f4e]">{item.title}</p>
                <p className="mt-1 text-xs text-slate-600">{item.status} · {formatDate(item.filed_at)}</p>
              </Link>
            ))}
            {publicCases.length === 0 ? <EmptyLine text="No hay expedientes públicos disponibles." /> : null}
          </Panel>
          <Panel title="Audiencias públicas" href="/audiencias">
            {publicHearings.map((hearing) => (
              <div key={hearing.id} className="border-b py-4 last:border-0">
                <p className="mono-number text-xs font-semibold text-[#005ea8]">{formatDateTime(hearing.scheduled_at)}</p>
                <h3 className="mt-2 text-sm font-semibold text-[#112f4e]">{hearing.title}</h3>
                <p className="mt-1 text-xs text-slate-600">{hearing.room} · {hearing.status}</p>
              </div>
            ))}
            {publicHearings.length === 0 ? <EmptyLine text="No hay audiencias públicas próximas." /> : null}
          </Panel>
          <Panel title="Órdenes públicas" href="/warrants">
            {publicWarrants.map((warrant) => (
              <article key={warrant.id} className="border-b py-4 last:border-0">
                <p className="mono-number text-xs font-semibold text-[#005ea8]">{warrant.warrant_number}</p>
                <p className="mt-2 text-sm font-semibold text-[#112f4e]">{warrant.warrant_type}</p>
                <p className="mt-1 text-xs text-slate-600">{warrant.status} · vence {formatDate(warrant.expires_at)}</p>
              </article>
            ))}
            {publicWarrants.length === 0 ? <EmptyLine text="No hay órdenes públicas disponibles." /> : null}
          </Panel>
        </div>
      </section>
    </>
  );
}

function excerpt(value: string) {
  return value.replace(/[#*_`>-]/g, "").replace(/\s+/g, " ").trim().slice(0, 180) || "Contenido institucional disponible para consulta.";
}

function EmptyLine({ text }: { text: string }) {
  return <p className="p-5 text-sm leading-6 text-slate-600">{text}</p>;
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
