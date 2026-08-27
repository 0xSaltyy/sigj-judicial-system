import Link from "next/link";
import { ArrowRight, ClipboardCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Convocatorias" };

export default function ConvocatoriasPage() {
  return (
    <section className="bg-[#fffdf8]">
      <div className="site-container public-section">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8f1d1d]">Public opportunities</p>
          <h1 className="mt-4 font-serif text-4xl font-semibold text-[#0a2540]">Convocatorias y postulaciones</h1>
          <p className="mt-4 text-base leading-8 text-slate-700">
            Consulte oportunidades abiertas, envíe una postulación y revise el estado con el código de seguimiento recibido.
          </p>
        </div>
        <div className="mt-10 grid gap-px border border-[#cfd6dc] bg-[#cfd6dc] md:grid-cols-2">
          <Link href="/postulaciones" className="group bg-[#fffdf8] p-7 transition hover:bg-[#f7f1e5]">
            <ClipboardCheck className="size-8 text-[#005ea8]" />
            <h2 className="mt-5 font-serif text-2xl font-semibold text-[#0a2540]">Ver postulaciones</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">Revise los canales disponibles para jueces, abogados y personal autorizado.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#005ea8]">Abrir <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
          </Link>
          <Link href="/convocatorias/estado" className="group bg-[#fffdf8] p-7 transition hover:bg-[#f7f1e5]">
            <Search className="size-8 text-[#005ea8]" />
            <h2 className="mt-5 font-serif text-2xl font-semibold text-[#0a2540]">Estado de mi postulación</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">Ingrese su código de seguimiento para consultar el estado público de su solicitud.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#005ea8]">Consultar <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
          </Link>
        </div>
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link href="/postulaciones">Ir al formulario de postulación</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
