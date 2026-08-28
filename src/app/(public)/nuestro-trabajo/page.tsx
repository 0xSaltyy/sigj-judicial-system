import { BriefcaseBusiness, FileText, Gavel, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";

export const metadata = { title: "Nuestro trabajo" };

const workAreas = [
  { title: "División Criminal", description: "Investigaciones, audiencias, warrants y coordinación con fiscales autorizados.", icon: Gavel },
  { title: "División Civil", description: "Gestión de controversias civiles, escritos, providencias y audiencias públicas.", icon: FileText },
  { title: "Registros y Seguridad", description: "Custodia documental, permisos, auditoría y protección de archivos reservados.", icon: ShieldCheck },
  { title: "Administración Institucional", description: "Convocatorias, comunicaciones públicas, cuentas internas y seguimiento operativo.", icon: BriefcaseBusiness },
];

export default function WorkPage() {
  return (
    <>
      <PageHero eyebrow="Nuestro trabajo" title="Divisiones y funciones" description="Áreas de trabajo para administrar casos, órdenes, comunicaciones y registros internos." />
      <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-px border bg-slate-200 md:grid-cols-2">
          {workAreas.map(({ title, description, icon: Icon }) => (
            <article key={title} className="reveal bg-white p-7 transition hover:bg-[#edf5fb]">
              <Icon className="size-7 text-[#005ea8]" />
              <h2 className="mt-4 font-serif text-xl font-semibold text-[#102d49]">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
