import { PageHero } from "@/components/page-hero";
import { ROLEPLAY_NOTICE } from "@/lib/demo-data";

export const metadata = { title: "Acerca del Departamento" };

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Acerca del Departamento"
        title="Department of Justice Roleplay"
        description="Institución ficticia para coordinar expedientes, audiencias, comunicaciones y cargos dentro de una comunidad de roleplay."
      />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_.7fr] lg:px-8 lg:py-16">
        <section className="reveal rounded-xl border bg-white p-7">
          <h2 className="font-serif text-2xl font-semibold text-[#102d49]">Identidad y alcance</h2>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            Este portal simula una estructura institucional de justicia para historias, procesos y eventos de roleplay.
            Permite organizar tareas internas y ofrecer consulta pública limitada sin representar al Gobierno de Estados Unidos.
          </p>
          <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{ROLEPLAY_NOTICE}</p>
        </section>
        <aside className="reveal rounded-xl border bg-[#102d49] p-7 text-white">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#d1b56f]">Principios</p>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
            <li>Claridad permanente de que todo es ficticio.</li>
            <li>Acceso interno solo con cuentas creadas por OWNER.</li>
            <li>Documentos con marcas visibles de roleplay.</li>
            <li>Auditoría de cambios sensibles y permisos de servidor.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
