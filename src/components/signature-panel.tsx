import { Clock3, ShieldCheck, UserRoundCheck } from "lucide-react";
import {
  requestSignature,
  revokeCompletedSignature,
  revokeSignatureRequest,
} from "@/app/actions/signatures";
import { CopyLink } from "@/components/copy-link";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/demo-data";

type TargetType = "proceeding" | "hearing_minute" | "certificate" | "document";

export async function SignaturePanel({
  caseId,
  targetType,
  targetId,
  destination,
  signingLink,
  readOnly = false,
}: {
  caseId: string;
  targetType: TargetType;
  targetId: string;
  destination: string;
  signingLink?: string;
  readOnly?: boolean;
}) {
  const supabase = await createClient();
  if (!supabase) return null;
  const [
    { data: requests },
    { data: signatures },
    { data: users },
    { data: dependencies },
  ] = await Promise.all([
    supabase
      .from("signature_requests")
      .select(
        "id,signer_name,signer_title,signer_type,status,purpose,signature_order,expires_at,signed_at,revoked_at",
      )
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .order("signature_order"),
    supabase
      .from("signatures")
      .select(
        "id,signer_name,signer_title,signature_image_path,purpose,signature_order,signed_at,verification_code,status",
      )
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .eq("status", "signed")
      .order("signature_order"),
    readOnly
      ? Promise.resolve({ data: [] })
      : supabase
          .from("profiles")
          .select("id,full_name,position_title")
          .eq("is_active", true)
          .neq("role", "CONSULTA_PUBLICA")
          .order("full_name"),
    readOnly
      ? Promise.resolve({ data: [] })
      : supabase
          .from("dependencies")
          .select("id,name")
          .eq("is_active", true)
          .order("name"),
  ]);
  const signed = await Promise.all(
    (signatures ?? []).map(async (item) => {
      const { data } = await supabase.storage
        .from("signatures")
        .createSignedUrl(item.signature_image_path, 900);
      return { ...item, imageUrl: data?.signedUrl ?? null };
    }),
  );
  return (
    <section className="mt-6 space-y-4 no-print">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-[#8a6a2c]" />
        <h2 className="font-semibold text-[#153553]">Firmas y trazabilidad</h2>
      </div>
      {signingLink && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Enlace de firma generado
            </p>
            <p className="text-xs text-emerald-700">
              Se muestra una sola vez. Compártalo únicamente con el firmante.
            </p>
          </div>
          <CopyLink value={signingLink} label="Copiar enlace de firma" />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {signed.map((item) => (
          <article key={item.id} className="rounded-lg border bg-white p-4">
            {item.imageUrl && (
              <div className="flex h-24 items-center justify-center border-b pb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={`Firma de ${item.signer_name}`}
                  className="max-h-20 max-w-full object-contain"
                />
              </div>
            )}
            <p className="mt-3 font-semibold">{item.signer_name}</p>
            <p className="text-sm text-muted-foreground">{item.signer_title}</p>
            <p className="mt-2 text-xs">
              {item.purpose} · {formatDate(item.signed_at)}
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              {item.verification_code}
            </p>
            {!readOnly && (
              <form action={revokeCompletedSignature} className="mt-3">
                <input type="hidden" name="signature_id" value={item.id} />
                <input type="hidden" name="case_id" value={caseId} />
                <input type="hidden" name="destination" value={destination} />
                <SubmitButton
                  variant="outline"
                  size="sm"
                  pendingLabel="Revocando…"
                >
                  Revocar / reemplazar firma
                </SubmitButton>
              </form>
            )}
          </article>
        ))}
        {(requests ?? [])
          .filter((r) => r.status !== "signed")
          .map((request) => (
            <article
              key={request.id}
              className="rounded-lg border border-dashed bg-slate-50 p-4"
            >
              <p className="flex items-center gap-2 font-semibold">
                <Clock3 className="size-4" />
                {request.status === "pending" &&
                new Date(request.expires_at) <= new Date()
                  ? "Vencido"
                  : request.status === "pending"
                    ? "Firma pendiente"
                    : request.status === "revoked"
                      ? "Revocado"
                      : "Rechazado"}
              </p>
              <p className="mt-2 text-sm">
                {request.signer_name} · {request.signer_title}
              </p>
              <p className="text-xs text-muted-foreground">{request.purpose}</p>
              {!readOnly && request.status === "pending" && (
                <form action={revokeSignatureRequest} className="mt-3">
                  <input type="hidden" name="request_id" value={request.id} />
                  <input type="hidden" name="case_id" value={caseId} />
                  <input type="hidden" name="destination" value={destination} />
                  <SubmitButton
                    variant="outline"
                    size="sm"
                    pendingLabel="Revocando…"
                  >
                    Revocar solicitud
                  </SubmitButton>
                </form>
              )}
            </article>
          ))}
      </div>
      {!readOnly && (
        <details className="rounded-lg border bg-white p-4">
          <summary className="cursor-pointer font-semibold text-[#153553]">
            <UserRoundCheck className="mr-2 inline size-4" />
            Agregar firmante / solicitar firma
          </summary>
          <form
            action={requestSignature}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="case_id" value={caseId} />
            <input type="hidden" name="target_type" value={targetType} />
            <input type="hidden" name="target_id" value={targetId} />
            <input type="hidden" name="destination" value={destination} />
            <label className="text-sm">
              Tipo de firmante
              <select
                name="signer_type"
                defaultValue="external"
                className="mt-1 h-10 w-full rounded-md border bg-white px-3"
              >
                <option value="external">Persona externa</option>
                <option value="internal">Usuario interno</option>
                <option value="role">Rol institucional</option>
                <option value="dependency">Dependencia</option>
              </select>
            </label>
            <label className="text-sm">
              Usuario interno (opcional)
              <select
                name="signer_user_id"
                className="mt-1 h-10 w-full rounded-md border bg-white px-3"
              >
                <option value="">Sin seleccionar</option>
                {(users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Rol (opcional)
              <select
                name="signer_role"
                className="mt-1 h-10 w-full rounded-md border bg-white px-3"
              >
                <option value="">Sin seleccionar</option>
                <option value="MAGISTRADO_TRIBUNAL">Magistratura</option>
                <option value="JUEZ_CIRCUITO">Juez de circuito</option>
                <option value="SECRETARIO_DESPACHO">
                  Secretaría de despacho
                </option>
              </select>
            </label>
            <label className="text-sm">
              Dependencia (opcional)
              <select
                name="signer_dependency_id"
                className="mt-1 h-10 w-full rounded-md border bg-white px-3"
              >
                <option value="">Sin seleccionar</option>
                {(dependencies ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Nombre del firmante *
              <input
                name="signer_name"
                required
                className="mt-1 h-10 w-full rounded-md border px-3"
              />
            </label>
            <label className="text-sm">
              Cargo / calidad *
              <input
                name="signer_title"
                required
                className="mt-1 h-10 w-full rounded-md border px-3"
              />
            </label>
            <label className="text-sm">
              Correo (opcional)
              <input
                name="signer_email"
                type="email"
                className="mt-1 h-10 w-full rounded-md border px-3"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Se almacena sólo hash y versión enmascarada.
              </span>
            </label>
            <label className="text-sm">
              Finalidad *
              <input
                name="purpose"
                defaultValue={
                  targetType === "hearing_minute"
                    ? "Suscripción del acta"
                    : "Firma de providencia"
                }
                required
                className="mt-1 h-10 w-full rounded-md border px-3"
              />
            </label>
            <label className="text-sm">
              Orden
              <input
                name="signature_order"
                type="number"
                min="1"
                max="20"
                defaultValue={(requests?.length ?? 0) + 1}
                className="mt-1 h-10 w-full rounded-md border px-3"
              />
            </label>
            <label className="text-sm">
              Vigencia
              <select
                name="expires_hours"
                defaultValue="24"
                className="mt-1 h-10 w-full rounded-md border bg-white px-3"
              >
                <option value="1">1 hora</option>
                <option value="24">24 horas</option>
                <option value="168">7 días</option>
                <option value="720">30 días</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Generando enlace…">
                Solicitar firma
              </SubmitButton>
            </div>
          </form>
        </details>
      )}
    </section>
  );
}

export function SignaturePrintBlocks({
  signatures,
}: {
  signatures: Array<{
    id: string;
    signer_name: string;
    signer_title: string;
    purpose: string;
    signed_at: string;
    verification_code: string;
    imageUrl: string | null;
  }>;
}) {
  if (!signatures.length) return null;
  return (
    <section className="judicial-signature mt-14 grid gap-10 text-center sm:grid-cols-2">
      {signatures.map((item) => (
        <div key={item.id} className="break-inside-avoid">
          {item.imageUrl && (
            <div className="flex h-24 items-end justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt="Firma capturada"
                className="max-h-20 max-w-[240px] object-contain"
              />
            </div>
          )}
          <div className="mx-auto w-64 border-t border-slate-700 pt-2">
            <p className="text-sm font-semibold uppercase">
              {item.signer_name}
            </p>
            <p className="text-xs">{item.signer_title}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              {item.purpose} · {formatDate(item.signed_at)}
            </p>
            <p className="font-mono text-[9px] text-slate-500">
              {item.verification_code}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
