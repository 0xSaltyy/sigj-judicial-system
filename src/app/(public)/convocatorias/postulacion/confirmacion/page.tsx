import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { CopyTextButton } from "@/components/copy-text-button";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Postulación recibida",
  robots: { index: false, follow: false },
};

type ReceiptRow = {
  tracking_code: string;
  applicant_name: string;
  submitted_at: string;
  application_status: string;
  process_title: string;
  position_title: string;
  dependency_name: string;
  institution_name: string;
};

export default async function ApplicationReceipt({
  searchParams,
}: {
  searchParams: Promise<{ receipt?: string }>;
}) {
  const { receipt } = await searchParams;
  const supabase = await createClient();
  const { data } =
    supabase && receipt
      ? await supabase.rpc("get_selection_application_receipt", {
          p_receipt_token: receipt,
        })
      : { data: [] };
  const row = data?.[0] as ReceiptRow | undefined;

  return (
    <>
      <PageHero
        title="Postulación recibida correctamente"
        description="Comprobante de recepción del proceso de selección."
      />
      <main className="mx-auto max-w-2xl px-4 py-10">
        {row ? (
          <article className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
            <CheckCircle2 className="size-10 text-emerald-700" />
            <h1 className="mt-4 text-2xl font-semibold text-[#153553]">
              Postulación recibida correctamente
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Guarde este código. Lo necesitará para consultar el estado de su
              postulación.
            </p>

            <div className="mt-5 rounded-lg border bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Código de seguimiento
              </p>
              <p className="mt-2 break-all font-mono text-lg font-bold tracking-wide text-[#153553]">
                {row.tracking_code}
              </p>
              <div className="mt-3">
                <CopyTextButton text={row.tracking_code} label="Copiar código" />
              </div>
            </div>

            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <Fact label="Estado inicial" value="Recibida" />
              <Fact label="Convocatoria" value={row.process_title} />
              <Fact label="Cargo" value={row.position_title} />
              <Fact label="Institución" value={row.institution_name} />
              <Fact label="Despacho" value={row.dependency_name} />
              <Fact label="Postulante" value={row.applicant_name} />
              <Fact label="Fecha de envío" value={formatDate(row.submitted_at)} />
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/convocatorias/estado">
                  Consultar estado de mi postulación
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/convocatorias">Ver convocatorias</Link>
              </Button>
            </div>
          </article>
        ) : (
          <div className="rounded-xl border bg-white p-8 text-center">
            <h1 className="font-semibold text-[#153553]">
              Comprobante no disponible
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              El enlace es inválido o expiró. Si guardó su código, puede
              consultar el estado directamente.
            </p>
            <Button asChild className="mt-5">
              <Link href="/convocatorias/estado">
                Consultar estado de mi postulación
              </Link>
            </Button>
          </div>
        )}
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
