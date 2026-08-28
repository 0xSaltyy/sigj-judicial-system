import Link from "next/link";
import { ArrowRight, BookOpen, FileQuestion, LifeBuoy } from "lucide-react";
import { PageHero } from "@/components/page-hero";

export const metadata = { title: "Recursos" };

const resources = [
  { title: "Guía para consultar Federal Cases", description: "Cómo usar Case Number o Docket Number sin exponer Matters internos.", href: "/consulta", icon: FileQuestion },
  { title: "Reglas de documentos", description: "Cómo publicar Orders y consultar documentos públicos del sistema.", href: "/providencias", icon: BookOpen },
  { title: "Soporte del personal", description: "Acceso interno para cuentas creadas por OWNER.", href: "/login", icon: LifeBuoy },
];

export default function ResourcesPage() {
  return (
    <>
      <PageHero eyebrow="Recursos" title="Centro de recursos" description="Guías y accesos de apoyo para visitantes y personal autorizado." />
      <div className="mx-auto grid max-w-[1180px] gap-px border bg-slate-200 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8 lg:py-16">
        {resources.map(({ title, description, href, icon: Icon }) => (
          <Link key={title} href={href} className="reveal bg-white p-6 transition hover:bg-[#edf5fb]">
            <Icon className="size-7 text-[#005ea8]" />
            <h2 className="mt-4 font-serif text-xl font-semibold text-[#102d49]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            <span className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#8b6829]">Abrir <ArrowRight className="size-4" /></span>
          </Link>
        ))}
      </div>
    </>
  );
}
