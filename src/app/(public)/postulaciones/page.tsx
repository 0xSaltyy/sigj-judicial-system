import { Calendar, ClipboardCheck, Send } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { applications, formatDate } from "@/lib/demo-data";
import { submitRoleplayApplication } from "@/app/actions/roleplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const metadata = { title: "Postulaciones" };

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ submitted?: string; error?: string }> }) {
  const query = await searchParams;
  return (
    <>
      <PageHero
        eyebrow="Postulaciones"
        title="Postulaciones a juez, abogado e investigador"
        description="Convocatorias ficticias para cargos internos del Department of Justice Roleplay."
      />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_.85fr] lg:px-8 lg:py-16">
        <section className="grid gap-4">
          {applications.map((item) => (
            <article key={item.id} className="reveal interactive-card rounded-xl border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9a752f]">{item.status}</p>
                  <h2 className="mt-2 font-serif text-2xl font-semibold text-[#102d49]">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
                <div className="rounded bg-[#edf2f6] px-3 py-2 text-sm font-semibold text-[#153553]">{item.vacancies} vacantes</div>
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="size-4" /> Cierre: {formatDate(item.closes)}</p>
            </article>
          ))}
        </section>
        <aside className="reveal rounded-xl border bg-white p-6">
          <h2 className="font-serif text-2xl font-semibold text-[#102d49]">Formulario de postulación</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Este formulario demuestra los campos del flujo. En producción se guarda en Supabase y actualiza el panel interno en tiempo real.</p>
          {query.submitted && <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Postulación recibida correctamente.</p>}
          {query.error && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">{query.error}</p>}
          <form action={submitRoleplayApplication} className="mt-6 grid gap-4">
            <select name="application_type" required className="h-10 rounded-md border px-3 text-sm">
              <option value="juez">Postulación a juez</option>
              <option value="abogado">Registro de abogado</option>
              <option value="investigador">Investigador autorizado</option>
              <option value="personal">Personal autorizado</option>
            </select>
            <Input name="applicant_name" placeholder="Nombre del postulante" required />
            <Input name="contact_info" placeholder="Información de contacto" />
            <Textarea name="experience" placeholder="Experiencia" className="min-h-24" required />
            <Textarea name="education" placeholder="Formación" className="min-h-20" />
            <Textarea name="statement" placeholder="Carta o declaración personal" className="min-h-32" required />
            <Button type="submit" className="gap-2 bg-[#153b5c]"><Send className="size-4" /> Enviar postulación roleplay</Button>
          </form>
          <p className="mt-4 flex gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            <ClipboardCheck className="mt-0.5 size-4 shrink-0" /> Las postulaciones son ficticias y no equivalen a empleo, cargo público o licencia profesional real.
          </p>
        </aside>
      </div>
    </>
  );
}
