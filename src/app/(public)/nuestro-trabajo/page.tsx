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
        title="Divisiones y funciones del DOJ Roleplay"
        description="Áreas ficticias de trabajo para administrar casos, órdenes, comunicaciones y registros internos."
      />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-5 md:grid-cols-2">
          {workAreas.map((area, index) => {
            const Icon = icons[index] ?? Gavel;
            return (
              <article key={area.title} className="reveal interactive-card rounded-xl border bg-white p-6">
                <Icon className="size-7 text-[#9a752f]" />
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
