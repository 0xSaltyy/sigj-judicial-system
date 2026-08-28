import Link from "next/link";
import { ClipboardCheck, Send } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { submitRoleplayApplication } from "@/app/actions/roleplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const metadata = { title: "Postulaciones" };

const applicationTypes = [
  ["juez", "Postulación a juez"],
  ["abogado", "Registro de abogado"],
  ["investigador", "Investigador autorizado"],
  ["personal", "Personal autorizado"],
];

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ submitted?: string; error?: string }> }) {
  const query = await searchParams;
  return (
    <>
      <PageHero eyebrow="Postulaciones" title="Postulaciones a juez, abogado e investigador" description="Formulario público para cargos internos del Departamento." />
      <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8 lg:py-16">
        <section className="grid gap-4">
          <article className="reveal border bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9a752f]">Convocatorias</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-[#102d49]">Canal general de postulación</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Las solicitudes recibidas se revisan desde el panel interno. Si no hay vacantes activas, el componente autorizado podrá mantener la solicitud en archivo o cerrarla.</p>
            <Button asChild variant="outline" className="mt-5 rounded-none"><Link href="/convocatorias/estado">Consultar estado de postulación</Link></Button>
          </article>
          <div className="grid gap-px border bg-slate-200 sm:grid-cols-2">
            {applicationTypes.map(([value, label]) => <div key={value} className="bg-white p-5"><p className="font-serif text-lg font-semibold text-[#102d49]">{label}</p><p className="mt-2 text-sm text-slate-600">Seleccione esta opción en el formulario si corresponde a su solicitud.</p></div>)}
          </div>
        </section>
        <aside className="reveal border bg-white p-6">
          <h2 className="font-serif text-2xl font-semibold text-[#102d49]">Formulario de postulación</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">La información se registra en Supabase y actualiza el panel interno en tiempo real.</p>
          {query.submitted && <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Postulación recibida correctamente.</p>}
          {query.error && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">{query.error}</p>}
          <form action={submitRoleplayApplication} className="mt-6 grid gap-4">
            <select name="application_type" required className="h-10 rounded-none border px-3 text-sm">
              {applicationTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Input name="applicant_name" placeholder="Nombre del postulante" required className="rounded-none" />
            <Input name="contact_info" placeholder="Información de contacto" className="rounded-none" />
            <Textarea name="experience" placeholder="Experiencia" className="min-h-24 rounded-none" required />
            <Textarea name="education" placeholder="Formación" className="min-h-20 rounded-none" />
            <Textarea name="statement" placeholder="Carta o declaración personal" className="min-h-32 rounded-none" required />
            <Button type="submit" className="gap-2 rounded-none bg-[#005ea8] hover:bg-[#1a4480]"><Send className="size-4" /> Enviar postulación</Button>
          </form>
          <p className="mt-4 flex gap-2 border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
            <ClipboardCheck className="mt-0.5 size-4 shrink-0" /> Guarde el código de seguimiento que se entrega al enviar la solicitud.
          </p>
        </aside>
      </div>
    </>
  );
}
