import { FileText } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitBackgroundCheckRequest } from "@/app/actions/criminal-history";

export const metadata = { title: "Solicitudes de background check" };

export default async function BackgroundRequestsPage({ searchParams }: { searchParams: Promise<{ error?: string; submitted?: string; request?: string }> }) {
  const query = await searchParams;
  return (
    <>
      <PageHero eyebrow="Records and Background Checks" title="Solicitud formal de background check" description="Flujo separado para solicitudes con consentimiento del titular o propósito criminal-justice autorizado dentro del roleplay." />
      <main className="mx-auto max-w-[980px] px-4 py-12 sm:px-6 lg:px-8">
        {query.error ? <Alert className="mb-5 border-red-200 bg-red-50"><AlertDescription>{query.error}</AlertDescription></Alert> : null}
        {query.submitted ? (
          <Alert className="mb-5 border-emerald-200 bg-emerald-50">
            <FileText className="size-4" />
            <AlertDescription>Solicitud recibida con número <span className="mono-number font-semibold">{query.request}</span>. Será revisada antes de cualquier respuesta de fondo.</AlertDescription>
          </Alert>
        ) : null}
        <Card>
          <CardHeader><CardTitle className="font-serif text-2xl text-[#102d49]">Datos de solicitud autorizada</CardTitle></CardHeader>
          <CardContent>
            <form action={submitBackgroundCheckRequest} className="grid gap-5">
              <Field label="Nombre del sujeto" name="subject_legal_name" required />
              <Field label="Fecha de nacimiento del sujeto" name="subject_date_of_birth" type="date" />
              <Field label="Organización solicitante" name="requesting_organization" required />
              <LongField label="Propósito autorizado" name="authorized_purpose" placeholder="Propósito criminal-justice o revisión consentida…" />
              <LongField label="Consentimiento o fundamento autorizado" name="legal_authority_or_consent" placeholder="Describa el consentimiento del titular o la autoridad interna aplicable." />
              <LongField label="Alcance" name="scope" placeholder="Qué registros del portal serán revisados y durante qué periodo." />
              <Button className="w-fit rounded-none bg-[#153b5c]">Registrar solicitud</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return <div className="grid gap-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} /></div>;
}
function LongField({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) {
  return <div className="grid gap-2"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} required placeholder={placeholder} /></div>;
}
