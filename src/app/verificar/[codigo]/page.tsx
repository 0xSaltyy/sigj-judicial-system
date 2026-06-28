import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { VerificationQr } from "@/components/verification-qr";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Verificación documental" };

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.rpc("public_verification_lookup", { p_code: codigo })
    : { data: [] };
  const row = data?.[0];
  if (!row) notFound();
  const valid = row.status === "valid";

  return (
    <>
      <PageHero
        title="Verificación documental"
        description="Consulta pública de autenticidad y estado de documentos verificables."
      />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <article className="grid gap-6 rounded-2xl border bg-white p-6 shadow-sm md:grid-cols-[1fr_180px]">
          <div>
            <Badge
              variant="outline"
              className={valid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}
            >
              {valid ? "Válido" : row.status === "revoked" ? "Revocado" : "Archivado"}
            </Badge>
            <h1 className="mt-4 break-words text-2xl font-semibold text-[#153553]">
              {row.title}
            </h1>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <Fact label="Tipo documental" value={row.document_type} />
              <Fact label="Institución" value={row.institution ?? "Palacio Judicial"} />
              <Fact label="Código" value={row.verification_code} />
              <Fact label="Fecha de emisión" value={formatDate(row.issued_at)} />
            </dl>
            <div className="mt-6 rounded-lg border bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {row.reserved ? (
                <p className="flex gap-2">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  Documento verificable, contenido reservado.
                </p>
              ) : (
                <p className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                  La verificación muestra únicamente metadatos públicos seguros.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-center">
            <VerificationQr code={row.verification_code} />
          </div>
        </article>
      </main>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}
