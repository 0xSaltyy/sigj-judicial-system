import { RotateCcw } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitCriminalHistoryCorrectionRequest } from "@/app/actions/criminal-history";

export const metadata = { title: "Corrección de registros" };

export default async function CorrectionPage({ searchParams }: { searchParams: Promise<{ error?: string; submitted?: string; request?: string }> }) {
  const query = await searchParams;
  return (
    <>
      <PageHero eyebrow="Registros y antecedentes" title="Solicitar corrección de un registro" description="Canal privado para cuestionar información incompleta o incorrecta dentro de los registros del portal." />
      <main className="mx-auto max-w-[980px] px-4 py-12 sm:px-6 lg:px-8">
        {query.error ? <Alert className="mb-5 border-red-200 bg-red-50"><AlertDescription>{query.error}</AlertDescription></Alert> : null}
        {query.submitted ? (
          <Alert className="mb-5 border-emerald-200 bg-emerald-50">
            <RotateCcw className="size-4" />
            <AlertDescription>Solicitud de corrección recibida: <span className="mono-number font-semibold">{query.request}</span>.</AlertDescription>
          </Alert>
        ) : null}
        <Card>
          <CardHeader><CardTitle className="font-serif text-2xl text-[#102d49]">Challenge / correction request</CardTitle></CardHeader>
          <CardContent>
            <form action={submitCriminalHistoryCorrectionRequest} className="grid gap-5">
              <Field label="Person Record Number, si lo conoce" name="person_record_number" placeholder="RP-PER-2026-100001" />
              <Field label="Evento o registro cuestionado" name="challenged_event" required />
              <div className="grid gap-2">
                <Label htmlFor="explanation">Explicación</Label>
                <Textarea id="explanation" name="explanation" required placeholder="Indique qué dato es incorrecto, incompleto o debe ser revisado…" />
              </div>
              <Field label="Medio de contacto" name="contact_method" />
              <div className="grid gap-2">
                <Label htmlFor="supporting_document">Documento de soporte opcional</Label>
                <Input id="supporting_document" name="supporting_document" type="file" accept=".pdf,image/png,image/jpeg,text/plain" />
              </div>
              <Button className="w-fit rounded-none bg-[#153b5c]">Enviar corrección</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function Field({ label, name, type = "text", placeholder, required = false }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return <div className="grid gap-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} placeholder={placeholder} required={required} /></div>;
}
