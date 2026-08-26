import { BriefcaseBusiness, FileText, Gavel, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { workAreas } from "@/lib/demo-data";

export const metadata = { title: "Nuestro trabajo" };

const icons = [Gavel, FileText, ShieldCheck, BriefcaseBusiness];

export default function WorkPage() {
  return (
    <>
      <PageHero
        eyebrow="Nuestro trabajo"
        title="Divisiones y funciones"
        description="Áreas de trabajo para administrar casos, órdenes, comunicaciones y registros internos."
      />
      <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-px border bg-slate-200 md:grid-cols-2">
          {workAreas.map((area, index) => {
            const Icon = icons[index] ?? Gavel;
            return (
              <article key={area.title} className="reveal bg-white p-7 transition hover:bg-[#edf5fb]">
                <Icon className="size-7 text-[#005ea8]" />
                <h2 className="mt-4 font-serif text-xl font-semibold text-[#102d49]">{area.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{area.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
