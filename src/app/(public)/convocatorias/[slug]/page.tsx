import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, MapPin, SearchCheck } from "lucide-react";
import { submitSelectionApplication } from "@/app/actions/selection";
import { ActionMessage } from "@/components/action-message";
import { PageHero } from "@/components/page-hero";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";

export default async function PublicSelection({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase
        .from("public_selection_processes")
        .select("*")
        .eq("slug", slug)
        .maybeSingle()
    : { data: null };

  if (!data) notFound();

  return (
    <>
      <PageHero
        title={data.title}
        description={`${data.position_title} · ${data.dependency_name}`}
      />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <article className="min-w-0 space-y-6 rounded-xl border bg-white p-6">
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="size-4" />
              {data.institution_name} · {data.dependency_name}
            </span>
            <span className="flex items-center gap-1">
              <CalendarClock className="size-4" />
              Cierre: {formatDate(data.closing_at)}
            </span>
          </div>
          <Section title="Descripción" text={data.description} />
          <Section title="Requisitos" text={data.requirements} />
          {data.responsibilities && (
            <Section title="Responsabilidades" text={data.responsibilities} />
          )}
          <Section title="Vacantes" text={String(data.vacancies)} />
          {data.application_instructions && (
            <Section title="Instrucciones" text={data.application_instructions} />
          )}
        </article>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9a752f]">
              ¿Ya se postuló?
            </p>
            <h2 className="mt-1 font-semibold text-[#153553]">
              Estado de mi postulación
            </h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Consulte el avance con su código de seguimiento y correo.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3 w-full">
              <Link href="/convocatorias/estado">
                <SearchCheck className="size-4" />
                Ver estado
              </Link>
            </Button>
          </div>

          <ActionMessage error={query.error} />
          <form action={submitSelectionApplication} className="grid gap-4 rounded-xl border bg-white p-6">
            <h2 className="font-semibold text-[#153553]">Presentar postulación</h2>
            <input type="hidden" name="process_id" value={data.id} />
            <input type="hidden" name="slug" value={slug} />
            <label className="hidden" aria-hidden="true">
              Sitio web
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <Field label="Nombre completo *">
              <Input name="applicant_name" required maxLength={180} />
            </Field>
            <Field label="Correo de contacto *">
              <Input name="applicant_email" type="email" required maxLength={320} />
            </Field>
            <Field label="Identificador de usuario (opcional)">
              <Input
                name="applicant_identifier"
                maxLength={160}
                placeholder="Usuario institucional, Discord o Roblox"
              />
            </Field>
            <Field label="Teléfono (opcional)">
              <Input name="phone" maxLength={80} />
            </Field>
            <Field label="Carta de presentación *">
              <Textarea
                name="statement"
                required
                minLength={20}
                maxLength={12000}
                className="min-h-36"
              />
            </Field>
            <Field label="Experiencia relevante">
              <Textarea name="experience" maxLength={12000} />
            </Field>
            <p className="text-xs leading-5 text-muted-foreground">
              Sus datos se entregan únicamente al despacho responsable. No se
              publican ni se muestran a otros postulantes.
            </p>
            <SubmitButton pendingLabel="Enviando…">Enviar postulación</SubmitButton>
          </form>
        </aside>
      </main>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#153553]">
        {title}
      </h2>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
        {text}
      </p>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}
