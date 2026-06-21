import { Clock3, Link2, PenLine, ShieldCheck, UserRoundCheck } from "lucide-react";
import {
  assignInternalSignature,
  completeInternalSignature,
  requestSignature,
  revokeCompletedSignature,
  revokeSignatureRequest,
  signNow,
} from "@/app/actions/signatures";
import { CopyLink } from "@/components/copy-link";
import { SignaturePad } from "@/components/signature-pad";
import { SubmitButton } from "@/components/submit-button";
import { formatDate } from "@/lib/demo-data";
import { formalSignerName, formalSignerTitle } from "@/lib/signature-display";
import { signatureImageDataUrl } from "@/lib/signature-images";
import { createClient } from "@/lib/supabase/server";

type TargetType = "proceeding" | "hearing_minute" | "certificate" | "document" | "vote_document";

export async function SignaturePanel({
  caseId,
  targetType,
  targetId,
  destination,
  signingLink,
  readOnly = false,
  canManage = true,
  canRequest,
  canRevoke,
  canSign = true,
}: {
  caseId: string;
  targetType: TargetType;
  targetId: string;
  destination: string;
  signingLink?: string;
  readOnly?: boolean;
  canManage?: boolean;
  canRequest?: boolean;
  canRevoke?: boolean;
  canSign?: boolean;
}) {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const allowRequest = !readOnly && (canRequest ?? canManage);
  const allowRevoke = !readOnly && (canRevoke ?? canManage);
  const allowSign = !readOnly && canSign;
  const [{ data: requests }, { data: signatures }, { data: users }, { data: currentProfile }] =
    await Promise.all([
      supabase
        .from("signature_requests")
        .select(
          "id,signer_user_id,signer_name,signer_title,signer_type,status,purpose,signature_order,expires_at,signed_at,revoked_at",
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
      !allowRequest
        ? Promise.resolve({ data: [] })
        : supabase
            .from("profiles")
            .select("id,full_name,position_title")
            .eq("is_active", true)
            .neq("role", "CONSULTA_PUBLICA")
            .order("full_name"),
      !allowSign
        ? Promise.resolve({ data: null })
        : supabase
            .from("profiles")
            .select("full_name,position_title")
            .eq("id", user.id)
            .maybeSingle(),
    ]);
  const signed = await Promise.all(
    (signatures ?? []).map(async (item) => {
      return {
        ...item,
        imageUrl: await signatureImageDataUrl(supabase, item.signature_image_path),
      };
    }),
  );
  const pendingForCurrentUser = (requests ?? []).filter(
    (request) =>
      request.signer_type === "internal" &&
      request.signer_user_id === user.id &&
      request.status === "pending" &&
      !request.revoked_at &&
      new Date(request.expires_at) > new Date(),
  );
  const nextOrder = Math.max(
    0,
    ...(requests ?? []).map((item) => item.signature_order),
    ...(signatures ?? []).map((item) => item.signature_order),
  ) + 1;
  const defaultPurpose =
    targetType === "hearing_minute" ? "Suscripción del acta" : "Firma de providencia";
  const suggestedName = formalSignerName(currentProfile?.full_name);
  const suggestedTitle = formalSignerTitle(currentProfile?.position_title);

  return (
    <section className="mt-6 space-y-4 no-print">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-[#8a6a2c]" />
        <h2 className="font-semibold text-[#153553]">Firmas y trazabilidad</h2>
      </div>
      {signingLink && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div>
            <p className="text-sm font-semibold text-emerald-900">Enlace externo de firma generado</p>
            <p className="text-xs text-emerald-700">Se muestra una sola vez. Compártalo únicamente con el firmante externo.</p>
          </div>
          <CopyLink value={signingLink} label="Copiar enlace de firma" />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {signed.map((item) => {
          const displayName = formalSignerName(item.signer_name);
          const displayTitle = formalSignerTitle(item.signer_title);
          return (
            <article key={item.id} className="rounded-lg border bg-white p-4">
              {item.imageUrl && (
                <div className="flex h-24 items-center justify-center border-b pb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt={displayName ? `Firma de ${displayName}` : "Firma manuscrita"} className="max-h-20 max-w-full object-contain" />
                </div>
              )}
              {displayName ? <p className="mt-3 font-semibold">{displayName}</p> : <p className="mt-3 text-sm font-semibold text-amber-800">Nombre formal pendiente de corrección</p>}
              {displayTitle && <p className="text-sm text-muted-foreground">{displayTitle}</p>}
              <p className="mt-2 text-xs">{item.purpose} · {formatDate(item.signed_at)}</p>
              <p className="mt-1 font-mono text-[11px] text-slate-500">{item.verification_code}</p>
              {allowRevoke && (
                <form action={revokeCompletedSignature} className="mt-3">
                  <input type="hidden" name="signature_id" value={item.id} />
                  <input type="hidden" name="case_id" value={caseId} />
                  <input type="hidden" name="destination" value={destination} />
                  <SubmitButton variant="outline" size="sm" pendingLabel="Revocando…">Revocar / reemplazar firma</SubmitButton>
                </form>
              )}
            </article>
          );
        })}
        {(requests ?? [])
          .filter((request) => request.status !== "signed")
          .map((request) => (
            <article key={request.id} className="rounded-lg border border-dashed bg-slate-50 p-4">
              <p className="flex items-center gap-2 font-semibold">
                <Clock3 className="size-4" />
                {request.status === "pending" && new Date(request.expires_at) <= new Date()
                  ? "Vencido"
                  : request.status === "pending"
                    ? request.signer_type === "internal" ? "Firma interna pendiente" : "Firma externa pendiente"
                    : request.status === "revoked" ? "Revocado" : "Rechazado"}
              </p>
              <p className="mt-2 text-sm">{formalSignerName(request.signer_name) || "Nombre formal pendiente"}{formalSignerTitle(request.signer_title) ? ` · ${formalSignerTitle(request.signer_title)}` : ""}</p>
              <p className="text-xs text-muted-foreground">{request.purpose}</p>
              {allowRevoke && request.status === "pending" && (
                <form action={revokeSignatureRequest} className="mt-3">
                  <input type="hidden" name="request_id" value={request.id} />
                  <input type="hidden" name="case_id" value={caseId} />
                  <input type="hidden" name="destination" value={destination} />
                  <SubmitButton variant="outline" size="sm" pendingLabel="Revocando…">Revocar solicitud</SubmitButton>
                </form>
              )}
            </article>
          ))}
      </div>
      {allowSign && pendingForCurrentUser.map((request) => (
        <details key={request.id} className="rounded-lg border border-[#c9af70] bg-amber-50/50 p-4" open>
          <summary className="cursor-pointer font-semibold text-[#153553]"><PenLine className="mr-2 inline size-4" />Firmar ahora · {formalSignerName(request.signer_name) || "Firma asignada"}</summary>
          <p className="mt-2 text-sm text-muted-foreground">{formalSignerTitle(request.signer_title)} · {request.purpose}</p>
          <form action={completeInternalSignature} className="mt-4 space-y-4">
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="case_id" value={caseId} />
            <input type="hidden" name="target_type" value={targetType} />
            <input type="hidden" name="target_id" value={targetId} />
            <input type="hidden" name="destination" value={destination} />
            <SignaturePad />
            <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" required className="mt-0.5" />Confirmo que el trazo corresponde a mi firma y al documento indicado.</label>
            <SubmitButton pendingLabel="Registrando firma…">Confirmar y firmar</SubmitButton>
          </form>
        </details>
      ))}
      {allowSign && (
        <details className="rounded-lg border bg-white p-4">
          <summary className="cursor-pointer font-semibold text-[#153553]"><PenLine className="mr-2 inline size-4" />Firmar ahora</summary>
          <form action={signNow} className="mt-4 grid gap-3 sm:grid-cols-2">
            <SignatureContext caseId={caseId} targetType={targetType} targetId={targetId} destination={destination} />
            <SignatureIdentityFields defaultName={suggestedName} defaultTitle={suggestedTitle} />
            <PurposeAndOrderFields purpose={defaultPurpose} order={nextOrder} />
            <div className="sm:col-span-2"><SignaturePad /><p className="mt-2 text-xs text-muted-foreground">La firma se guardará directamente en el expediente. No se creará ningún enlace.</p></div>
            <div className="sm:col-span-2"><SubmitButton pendingLabel="Registrando firma…">Firmar ahora</SubmitButton></div>
          </form>
        </details>
      )}
      {allowRequest && (
        <details className="rounded-lg border bg-white p-4">
          <summary className="cursor-pointer font-semibold text-[#153553]"><UserRoundCheck className="mr-2 inline size-4" />Asignar firma a usuario interno</summary>
          <form action={assignInternalSignature} className="mt-4 grid gap-3 sm:grid-cols-2">
            <SignatureContext caseId={caseId} targetType={targetType} targetId={targetId} destination={destination} />
            <label className="text-sm">Usuario interno *<select name="signer_user_id" required className="mt-1 h-10 w-full rounded-md border bg-white px-3"><option value="">Seleccione…</option>{(users ?? []).map((item) => <option key={item.id} value={item.id}>{formalSignerName(item.full_name) || "Cuenta interna protegida"}{formalSignerTitle(item.position_title) ? ` · ${formalSignerTitle(item.position_title)}` : ""}</option>)}</select></label>
            <label className="text-sm">Vigencia<select name="expires_hours" defaultValue="720" className="mt-1 h-10 w-full rounded-md border bg-white px-3"><option value="24">24 horas</option><option value="168">7 días</option><option value="720">30 días</option></select></label>
            <SignatureIdentityFields />
            <PurposeAndOrderFields purpose={defaultPurpose} order={nextOrder} />
            <p className="text-xs text-muted-foreground sm:col-span-2">El usuario seleccionado verá “Firmar ahora” cuando ingrese al documento. No se genera ni se muestra un enlace externo.</p>
            <div className="sm:col-span-2"><SubmitButton pendingLabel="Asignando firma…">Asignar firma interna</SubmitButton></div>
          </form>
        </details>
      )}
      {allowRequest && (
        <details className="rounded-lg border bg-white p-4">
          <summary className="cursor-pointer font-semibold text-[#153553]"><Link2 className="mr-2 inline size-4" />Solicitar firma por enlace</summary>
          <form action={requestSignature} className="mt-4 grid gap-3 sm:grid-cols-2">
            <SignatureContext caseId={caseId} targetType={targetType} targetId={targetId} destination={destination} />
            <SignatureIdentityFields />
            <label className="text-sm">Correo externo (opcional)<input name="signer_email" type="email" className="mt-1 h-10 w-full rounded-md border px-3" /><span className="mt-1 block text-xs text-muted-foreground">Se almacena sólo hash y versión enmascarada.</span></label>
            <label className="text-sm">Vigencia<select name="expires_hours" defaultValue="24" className="mt-1 h-10 w-full rounded-md border bg-white px-3"><option value="1">1 hora</option><option value="24">24 horas</option><option value="168">7 días</option><option value="720">30 días</option></select></label>
            <PurposeAndOrderFields purpose={defaultPurpose} order={nextOrder} />
            <p className="text-xs text-muted-foreground sm:col-span-2">Use este flujo únicamente para un firmante externo o cuando necesite compartir deliberadamente un enlace acotado.</p>
            <div className="sm:col-span-2"><SubmitButton pendingLabel="Generando enlace…">Solicitar firma por enlace</SubmitButton></div>
          </form>
        </details>
      )}
    </section>
  );
}

function SignatureContext({ caseId, targetType, targetId, destination }: { caseId: string; targetType: TargetType; targetId: string; destination: string }) {
  return <><input type="hidden" name="case_id" value={caseId} /><input type="hidden" name="target_type" value={targetType} /><input type="hidden" name="target_id" value={targetId} /><input type="hidden" name="destination" value={destination} /></>;
}

function SignatureIdentityFields({ defaultName = "", defaultTitle = "" }: { defaultName?: string; defaultTitle?: string }) {
  return <><label className="text-sm">Nombre para firma *<input name="signer_name" defaultValue={defaultName} required className="mt-1 h-10 w-full rounded-md border px-3" placeholder="Nombre que aparecerá en el documento" /></label><label className="text-sm">Cargo/título para firma *<input name="signer_title" defaultValue={defaultTitle} required className="mt-1 h-10 w-full rounded-md border px-3" placeholder="Ej. Magistrada Ponente" /></label></>;
}

function PurposeAndOrderFields({ purpose, order }: { purpose: string; order: number }) {
  return <><label className="text-sm">Finalidad *<input name="purpose" defaultValue={purpose} required className="mt-1 h-10 w-full rounded-md border px-3" /></label><label className="text-sm">Orden<input name="signature_order" type="number" min="1" max="20" defaultValue={Math.min(order, 20)} className="mt-1 h-10 w-full rounded-md border px-3" /></label></>;
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
  const printable = signatures
    .map((item) => ({ ...item, signer_name: formalSignerName(item.signer_name), signer_title: formalSignerTitle(item.signer_title) }))
    .filter((item) => item.signer_name && item.signer_title);
  if (!printable.length) return null;
  const timestamp = (value: string) => new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(value));
  return (
    <section className="judicial-signature mt-14 grid gap-10 text-center sm:grid-cols-2">
      {printable.map((item) => (
        <div key={item.id} className="break-inside-avoid">
          {item.imageUrl ? (
            <div className="flex h-24 items-end justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={`Firma manuscrita de ${item.signer_name}`} className="signature-ink-image max-h-20 max-w-[240px] object-contain" />
            </div>
          ) : (
            <p className="flex h-24 items-end justify-center pb-3 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Imagen de firma no disponible
            </p>
          )}
          <div className="mx-auto w-64 border-t border-slate-700 pt-2">
            <p className="text-sm font-semibold uppercase">{item.signer_name}</p>
            <p className="text-xs">{item.signer_title}</p>
            <p className="mt-1 text-[10px] text-slate-500">{item.purpose} · {timestamp(item.signed_at)}</p>
            <p className="font-mono text-[9px] text-slate-500">Código de verificación: {item.verification_code}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
