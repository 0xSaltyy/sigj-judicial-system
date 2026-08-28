import { ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitSelfCriminalHistoryRequest } from "@/app/actions/criminal-history";

export const metadata = { title: "Solicitar mi resumen de antecedentes" };

export default async function SelfHistoryRequestPage({ searchParams }: { searchParams: Promise<{ error?: string; submitted?: string; request?: string }> }) {
  const query = await searchParams;
  return (
    <>
      <PageHero
        eyebrow="Registros y antecedentes"
        title="Solicitar mi resumen de antecedentes"
        description="Servicio privado para que una persona solicite revisión de los registros mantenidos dentro de este portal de roleplay."
      />
      <main className="mx-auto grid max-w-[1180px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <section>
          {query.error ? <Alert className="mb-5 border-red-200 bg-red-50"><AlertDescription>{query.error}</AlertDescription></Alert> : null}
          {query.submitted ? (
            <Alert className="mb-5 border-emerald-200 bg-emerald-50">
              <ShieldCheck className="size-4" />
              <AlertDescription>
                Solicitud recibida. Número de solicitud: <span className="mono-number font-semibold">{query.request}</span>. El portal no confirma ni descarta coincidencias antes de la verificación privada.
              </AlertDescription>
            </Alert>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl text-[#102d49]">Solicitud privada del titular</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={submitSelfCriminalHistoryRequest} className="grid gap-5">
                <Field label="Nombre legal completo" name="legal_name" required />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Fecha de nacimiento" name="date_of_birth" type="date" />
                  <Field label="Person Record Number, si lo conoce" name="person_record_number" placeholder="RP-PER-2026-100001" />
                </div>
                <Field label="Código privado o token de verificación, si ya fue emitido" name="private_access_code" />
                <div className="grid gap-2">
                  <Label htmlFor="request_purpose">Propósito de la solicitud</Label>
                  <Textarea id="request_purpose" name="request_purpose" required placeholder="Revisión personal del resumen mantenido en el portal…" />
                </div>
                <Field label="Medio de contacto para revisión privada" name="requester_contact" placeholder="Discord, Roblox, correo ficticio o medio interno" />
                <label className="flex gap-3 text-sm leading-6 text-slate-700">
                  <input name="subject_declaration" type="checkbox" required className="mt-1" />
                  Declaro que solicito mi propio resumen y no el historial privado de otra persona.
                </label>
                <label className="flex gap-3 text-sm leading-6 text-slate-700">
                  <input name="consent_acknowledged" type="checkbox" required className="mt-1" />
                  Entiendo que este resultado cubre únicamente registros ingresados en este portal de roleplay.
                </label>
                <Button className="w-fit rounded-none bg-[#153b5c]">Enviar solicitud privada</Button>
              </form>
            </CardContent>
          </Card>
        </section>
        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Limitación obligatoria</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
              <p>This search covers only records entered into this roleplay portal. It is not a nationwide FBI, state, local or commercial background check.</p>
              <p>No recolecte SSN reales, huellas reales ni datos sensibles innecesarios.</p>
              <p>Si no tiene código privado, la solicitud queda para revisión administrativa sin revelar si existe o no coincidencia.</p>
            </CardContent>
          </Card>
        </aside>
      </main>
    </>
  );
}

function Field({ label, name, type = "text", placeholder, required = false }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required={required} />
    </div>
  );
}
