import { ShieldCheck } from "lucide-react";
import { completeSignature, declineSignature } from "@/app/actions/signatures";
import { ActionMessage } from "@/components/action-message";
import { InstitutionalMark } from "@/components/institutional-mark";
import { SignaturePad } from "@/components/signature-pad";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSecret } from "@/lib/secure-tokens";

export default async function SigningPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const admin = createAdminClient();
  const { data: request } = admin
    ? await admin
        .from("signature_requests")
        .select(
          "id,target_type,target_id,signer_name,signer_title,purpose,status,expires_at,revoked_at",
        )
        .eq("token_hash", hashSecret(token))
        .maybeSingle()
    : { data: null };
  const valid =
    request &&
    request.status === "pending" &&
    !request.revoked_at &&
    new Date(request.expires_at) > new Date();
  if (admin && request && !valid && !query.success) {
    await admin.from("audit_logs").insert({
      action: "SIGNING_LINK_ACCESS_DENIED",
      table_name: "signature_requests",
      record_id: request.id,
      description: "Intento de acceso a un enlace de firma no vigente",
      metadata: { status: request.status, target_type: request.target_type },
    });
  }
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <InstitutionalMark size={64} />
          <div>
            <p className="text-xs uppercase tracking-[.18em] text-[#8a6a2c]">
              Palacio Judicial
            </p>
            <h1 className="font-semibold text-[#153553]">
              Firma electrónica acotada
            </h1>
          </div>
        </div>
        <ActionMessage error={query.error} success={query.success} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-[#8a6a2c]" />
              Solicitud de firma
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!request ? (
              <p className="text-sm text-muted-foreground">
                El enlace no existe o no está disponible.
              </p>
            ) : !valid ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Este enlace ya fue utilizado, revocado o venció. Solicite un
                nuevo enlace a la dependencia.
              </div>
            ) : (
              <>
                <dl className="mb-6 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Firmante</dt>
                    <dd className="font-semibold">{request.signer_name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Cargo / calidad</dt>
                    <dd className="font-semibold">{request.signer_title}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Finalidad</dt>
                    <dd>{request.purpose}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Documento</dt>
                    <dd>
                      {request.target_type === "hearing_minute"
                        ? "Acta de audiencia"
                        : "Providencia o documento formal"}
                    </dd>
                  </div>
                </dl>
                <form action={completeSignature} className="space-y-5">
                  <input type="hidden" name="token" value={token} />
                  <SignaturePad />
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" required className="mt-0.5" />
                    Confirmo que el trazo corresponde a mi firma y que firmo
                    únicamente el documento indicado.
                  </label>
                  <SubmitButton
                    className="w-full"
                    pendingLabel="Registrando firma…"
                  >
                    Confirmar y firmar
                  </SubmitButton>
                </form>
                <form action={declineSignature} className="mt-3">
                  <input type="hidden" name="token" value={token} />
                  <SubmitButton
                    className="w-full"
                    variant="outline"
                    pendingLabel="Registrando rechazo…"
                  >
                    Rechazar solicitud de firma
                  </SubmitButton>
                </form>
              </>
            )}
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs text-slate-500">
          Este enlace no concede acceso al panel administrativo ni a otros
          expedientes.
        </p>
      </div>
    </main>
  );
}
