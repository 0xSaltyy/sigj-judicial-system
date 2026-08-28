import { PageHero } from "@/components/page-hero";

export const metadata = { title: "Acerca del Departamento" };

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Acerca del Departamento"
        title="U.S. Department of Justice"
        description="Institución encargada de coordinar DOJ Matters, Federal Cases, hearings, comunicaciones y servicios internos para la comunidad."
      />
      <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8 lg:py-16">
        <section className="reveal border bg-white p-7">
          <h2 className="font-serif text-2xl font-semibold text-[#102d49]">Identidad y alcance</h2>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            Este portal organiza tareas internas, servicios públicos, registros de hearings, Federal Cases y publicaciones
            con una estructura institucional clara y controlada.
          </p>
        </section>
        <aside className="reveal border-l-4 border-[#b21b1b] bg-[#f5f7f9] p-7">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#5b7287]">Principios</p>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
            <li className="text-slate-700">Acceso interno solo con cuentas creadas por OWNER.</li>
            <li className="text-slate-700">Auditoría de cambios sensibles.</li>
            <li className="text-slate-700">Permisos verificados desde el servidor.</li>
            <li className="text-slate-700">Publicación pública limitada y organizada.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
