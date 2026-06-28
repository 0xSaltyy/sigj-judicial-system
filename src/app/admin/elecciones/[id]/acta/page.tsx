import Link from "next/link";
import { generateElectionAct } from "@/app/actions/elections";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { VerificationQr } from "@/components/verification-qr";
import { Button } from "@/components/ui/button";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

type PercentageRow = {
  option_id: string;
  card_label: string;
  candidate_name: string;
  public_percent: number | string;
};

export default async function ElectionActPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, query, { supabase }] = await Promise.all([
    params,
    searchParams,
    requirePermission(PERMISSIONS.electionsGenerateAct),
  ]);
  const [{ data: election }, { data: acts }, { data: results }] = await Promise.all([
    supabase.from("elections").select("*,institution:dependencies(name)").eq("id", id).maybeSingle(),
    supabase
      .from("election_acts")
      .select("*,verification:document_verifications(verification_code,status,issued_at)")
      .eq("election_id", id)
      .order("generated_at", { ascending: false }),
    supabase.rpc("election_public_percentage_totals", { p_election_id: id }),
  ]);
  const latest = acts?.[0];
  const resultRows = (results ?? []) as PercentageRow[];

  return (
    <>
      <AdminPageHeader
        title="Acta General de Escrutinio"
        description={election?.title ?? "Acta electoral"}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/admin/elecciones/${id}`}>Volver</Link>
            </Button>
            <form action={generateElectionAct}>
              <input type="hidden" name="election_id" value={id} />
              <SubmitButton pendingLabel="Generando…" confirmMessage="Esta acción generará o preparará el acta electoral para revisión. ¿Continuar?">Generar acta electoral</SubmitButton>
            </form>
          </div>
        }
      />
      <ActionMessage error={query.error} success={query.success} />
      <details className="mb-5 rounded-xl border bg-amber-50 p-4 text-sm text-amber-950">
        <summary className="cursor-pointer font-semibold">¿Qué significa esto?</summary>
        <p className="mt-2 leading-6">Cuando el avance validado llega al 100%, el sistema prepara el acta electoral para revisión. La publicación definitiva y la declaración del ganador oficial siguen siendo acciones humanas autorizadas.</p>
      </details>
      <section className="print-document paper formal-document mx-auto rounded-xl border bg-white">
        <div className="formal-header">
          <p className="formal-kicker">República de Colombia</p>
          <p className="formal-room">Palacio Judicial</p>
          <h1 className="formal-document-title">Acta General de Escrutinio</h1>
        </div>
        <dl className="formal-metadata-table">
          <Row label="Elección" value={election?.title ?? "Sin elección"} />
          <Row label="Cargo" value={election?.office ?? "Sin cargo"} />
          <Row label="Periodo" value={election?.period ?? "Sin periodo"} />
          <Row label="Vuelta" value={election?.round_label ?? "Sin vuelta"} />
          <Row label="Jurisdicción" value={election?.territory ?? "Sin jurisdicción"} />
          <Row label="Estado" value={election?.status ?? "Sin estado"} />
          <Row label="Generada" value={latest ? formatDate(latest.generated_at) : "Pendiente de generación"} />
        </dl>
        <section className="judicial-rich-text mt-8">
          <h2>Resultados públicos porcentuales</h2>
          <div className="mt-4 grid gap-3">
            {resultRows.map((row) => (
              <div key={row.option_id} className="avoid-page-break border-b pb-2">
                <p>
                  <strong>{row.card_label} — {row.candidate_name}:</strong>{" "}
                  {Number(row.public_percent).toFixed(2)}%
                </p>
              </div>
            ))}
          </div>
          {!resultRows.length && <p>Los resultados porcentuales aparecerán cuando sean publicados.</p>}
          <p className="mt-8">
            Se deja constancia de que el presente documento corresponde a una
            generación formal del sistema, con validación humana y trazabilidad
            interna reservada.
          </p>
        </section>
        {latest?.verification?.verification_code && (
          <div className="mt-10 flex justify-end">
            <VerificationQr code={latest.verification.verification_code} />
          </div>
        )}
      </section>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}
