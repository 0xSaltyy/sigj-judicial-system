import Link from "next/link";
import { ArrowRight, FileCheck2, FileSearch, RotateCcw, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHero } from "@/components/page-hero";

export const metadata = { title: "Registros y antecedentes" };

const options: Array<{ title: string; href: string; icon: LucideIcon; description: string }> = [
  { title: "Buscar casos públicos", href: "/expedientes-publicos", icon: FileSearch, description: "Consulta pública limitada a Cases, docket entries y documentos marcados como public-safe." },
  { title: "Solicitar mi resumen", href: "/antecedentes/solicitar", icon: ShieldCheck, description: "Solicitud privada del titular con verificación ficticia y revisión administrativa." },
  { title: "Solicitar background check", href: "/antecedentes/solicitudes", icon: FileCheck2, description: "Flujo formal para solicitudes con consentimiento o propósito autorizado." },
  { title: "Solicitar corrección", href: "/antecedentes/correccion", icon: RotateCcw, description: "Challenge/correction request para registros incompletos o incorrectos." },
  { title: "Verificar documento", href: "/verificar-documento", icon: FileCheck2, description: "Verifica vigencia, tipo y estado sin exponer historiales privados." },
];

export default function RecordsHubPage() {
  return (
    <>
      <PageHero eyebrow="Records and Background Checks" title="Registros y antecedentes" description="Servicios separados para consulta pública de Cases, solicitudes privadas del titular, background checks autorizados y verificación documental limitada." />
      <main className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-px border bg-[#cfd6dc] md:grid-cols-2">
          {options.map(({ title, href, icon: Icon, description }) => (
            <Link key={href} href={href} className="group bg-[#fffdf8] p-7 transition hover:bg-[#f7f1e5]">
              <Icon className="size-8 text-[#005ea8]" />
              <h2 className="mt-5 font-serif text-2xl font-semibold text-[#102d49]">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">{description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#005ea8]">
                Abrir servicio <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
        <section className="mt-8 border-l-4 border-[#b38a3c] bg-white p-6 text-sm leading-7 text-slate-700">
          <h2 className="font-serif text-xl font-semibold text-[#102d49]">Información y limitaciones</h2>
          <p className="mt-2">
            No existe una búsqueda pública para obtener el historial privado de otra persona por nombre. Las respuestas privadas requieren verificación y cubren solamente registros mantenidos en este portal de roleplay.
          </p>
        </section>
      </main>
    </>
  );
}
