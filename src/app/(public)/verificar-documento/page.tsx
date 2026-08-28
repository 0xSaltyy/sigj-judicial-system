import { CheckCircle2, FileWarning } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/display";

export const metadata = { title: "Verificar documento" };

type VerificationResult = {
  valid: boolean;
  issue_date: string | null;
  expiration_date: string | null;
  document_type: string | null;
  status: string | null;
  limited_subject_display: string | null;
};

export default async function VerifyDocumentPage({ searchParams }: { searchParams: Promise<{ number?: string; code?: string }> }) {
  const query = await searchParams;
  const number = query.number?.trim() ?? "";
  const code = query.code?.trim() ?? "";
  const supabase = await createClient();
  const { data } = supabase && number && code ? await supabase.rpc("verify_record_document", { p_verification_number: number, p_document_hash: code }) : { data: null };
  const result = Array.isArray(data) && data.length > 0 ? data[0] as VerificationResult : null;
  return (
    <>
      <PageHero eyebrow="Verificación documental" title="Verificar documento del portal" description="Confirma solo vigencia, tipo y estado. Esta página no revela el contenido del resumen ni historiales privados." />
      <main className="mx-auto max-w-[920px] px-4 py-12 sm:px-6 lg:px-8">
        <Card>
          <CardHeader><CardTitle className="font-serif text-2xl text-[#102d49]">Código de verificación</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <div className="grid gap-2"><Label htmlFor="number">Document Verification Number</Label><Input id="number" name="number" defaultValue={number} placeholder="RP-VER-2026-100001" /></div>
              <div className="grid gap-2"><Label htmlFor="code">Hash o código secundario</Label><Input id="code" name="code" defaultValue={code} /></div>
              <Button className="self-end rounded-none bg-[#153b5c]">Verificar</Button>
            </form>
          </CardContent>
        </Card>
        {number && code ? (
          <div className="mt-6 border bg-white p-6">
            {result?.valid ? <CheckCircle2 className="size-7 text-emerald-700" /> : <FileWarning className="size-7 text-amber-700" />}
            <h2 className="mt-3 font-serif text-xl font-semibold text-[#102d49]">{result?.valid ? "Documento vigente" : "Documento no válido o no vigente"}</h2>
            <dl className="mt-5 grid gap-px bg-border sm:grid-cols-2">
              <Info label="Tipo" value={result?.document_type || "No disponible"} />
              <Info label="Estado" value={result?.status || "Invalid"} />
              <Info label="Fecha de emisión" value={formatDateTime(result?.issue_date)} />
              <Info label="Expira" value={formatDateTime(result?.expiration_date)} />
              <Info label="Sujeto limitado" value={result?.limited_subject_display || "No revelado"} />
            </dl>
          </div>
        ) : null}
      </main>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-4"><dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium text-[#153553]">{value}</dd></div>;
}
