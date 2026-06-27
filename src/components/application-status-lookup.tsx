"use client";

import { useActionState } from "react";
import { CheckCircle2, Info, Search, ShieldCheck } from "lucide-react";
import {
  lookupSelectionApplicationStatus,
  type ApplicationLookupState,
} from "@/app/actions/selection";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const initialState: ApplicationLookupState = {};

const labels: Record<string, string> = {
  recibida: "Recibida",
  en_revision: "En revisión",
  preseleccionada: "Preseleccionada",
  entrevista: "Entrevista",
  aceptada: "Aceptada",
  rechazada: "No seleccionada",
  archivada: "Archivada",
  proceso_cerrado: "Proceso cerrado",
  proceso_cancelado: "Proceso cancelado",
};

const messages: Record<string, string> = {
  recibida: "Su postulación fue recibida correctamente.",
  en_revision: "Su postulación está siendo revisada por el despacho.",
  preseleccionada: "Su postulación avanzó a la etapa de preselección.",
  entrevista:
    "Su postulación fue marcada para entrevista. Esté atento a las instrucciones oficiales.",
  aceptada: "Su postulación fue aceptada.",
  rechazada: "Su postulación no fue seleccionada en esta etapa.",
  archivada: "Su postulación fue archivada.",
  proceso_cerrado: "El proceso ya fue cerrado.",
  proceso_cancelado: "El proceso fue cancelado.",
};

export function ApplicationStatusLookup() {
  const [state, action] = useActionState(
    lookupSelectionApplicationStatus,
    initialState,
  );

  return (
    <section className="grid gap-6 lg:grid-cols-[410px_minmax(0,1fr)]">
      <form
        action={action}
        className="grid h-fit gap-5 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9a752f]">
            Panel del postulante
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#153553]">
            Estado de mi postulación
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ingrese el código recibido al enviar su postulación para consultar
            su estado.
          </p>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          Código de seguimiento
          <Input
            name="tracking_code"
            required
            maxLength={40}
            autoComplete="off"
            placeholder="POST-2026-…"
            className="font-mono uppercase"
          />
        </label>

        <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-950">
          Usuario de Discord o Roblox solo será solicitado dentro del formulario
          de postulación si la convocatoria lo requiere; no es necesario para
          esta consulta.
        </p>

        {state.error && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {state.error}
          </p>
        )}

        <SubmitButton pendingLabel="Consultando…">
          <Search className="size-4" />
          Consultar estado de mi postulación
        </SubmitButton>

        <p className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Por seguridad, el sistema no publica listados de postulantes ni
          permite consultar sin código de seguimiento.
        </p>
      </form>

      {state.result ? (
        <StatusResult result={state.result} />
      ) : (
        <div className="grid min-h-96 place-items-center rounded-2xl border border-dashed bg-white p-8 text-center">
          <div>
            <Search className="mx-auto size-10 text-slate-400" />
            <p className="mt-3 text-lg font-semibold text-[#153553]">
              Consulte su estado de forma privada
            </p>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              El resultado aparecerá aquí. No se muestran notas internas,
              puntajes, evaluadores, permisos, UUID internos ni datos de otros
              postulantes.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusResult({
  result,
}: {
  result: NonNullable<ApplicationLookupState["result"]>;
}) {
  const label = labels[result.status] ?? "En trámite";

  return (
    <article className="min-w-0 rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9a752f]">
            Resultado de consulta
          </p>
          <h2 className="mt-2 break-words text-2xl font-semibold text-[#153553]">
            {label}
          </h2>
          <p className="mt-2 break-words text-sm text-muted-foreground">
            {result.processTitle}
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-emerald-200 bg-emerald-50 text-emerald-800"
        >
          {label}
        </Badge>
      </div>

      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-start gap-2 text-sm font-medium text-emerald-950">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {messages[result.status] ?? "Consulte más adelante para conocer novedades."}
        </p>
        {result.message && (
          <div className="mt-3 border-t border-emerald-200 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
              Mensaje público del despacho
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-emerald-950">
              {result.message}
            </p>
          </div>
        )}
      </div>

      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <Fact label="Estado de la postulación" value={label} />
        <Fact label="Nombre del postulante" value={result.applicantName} />
        <Fact label="Convocatoria" value={result.processTitle} />
        <Fact label="Cargo" value={result.positionTitle} />
        <Fact label="Institución" value={result.institutionName} />
        <Fact label="Despacho/dependencia" value={result.dependencyName} />
        <Fact label="Fecha de postulación" value={formatDate(result.submittedAt)} />
        <Fact
          label="Última actualización pública"
          value={formatDate(result.updatedAt)}
        />
      </dl>

      <p className="mt-6 flex items-start gap-2 rounded-lg border bg-slate-50 p-3 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        La información mostrada corresponde únicamente a los datos públicos de
        seguimiento de esta postulación.
      </p>
    </article>
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
