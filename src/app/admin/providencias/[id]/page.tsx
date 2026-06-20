import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, PenLine } from "lucide-react";
import { publishProceeding } from "@/app/actions/proceedings";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ClearDrafts } from "@/components/clear-drafts";
import { FormalProvidenceDocument } from "@/components/formal-providence-document";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { PrintButton } from "@/components/print-button";
import { ShareAccessForm } from "@/components/share-access-form";
import {
  SignaturePanel,
} from "@/components/signature-panel";
import { Button } from "@/components/ui/button";
import { can, requirePermission } from "@/lib/auth/permissions";

export default async function ProceedingDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
    signingLink?: string;
  }>;
}) {
  const [{ id }, query, { supabase, profile }] = await Promise.all([
    params,
    searchParams,
    requirePermission({ resource: "providencias", action: "view" }),
  ]);
  const [{ data: proceeding }, { data: dependencies }, { data: users }] =
    await Promise.all([
      supabase
        .from("proceedings")
        .select(
          "*,case:cases(internal_number,judicial_number,authority_type,chamber,claimant_name,defendant_name,municipality,confidentiality_level,dependency:dependencies(name))",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("dependencies")
        .select("id,name")
        .eq("is_active", true)
        .order("name"),
      profile.is_owner
        ? supabase
            .from("profiles")
            .select("id,full_name")
            .eq("is_active", true)
            .neq("role", "CONSULTA_PUBLICA")
            .order("full_name")
        : Promise.resolve({ data: [] }),
    ]);
  if (!proceeding) notFound();
  const [canWrite, canPublish, canShare, canManageSignatures, canArchive, canRestore, canHardDelete] = await Promise.all([
    can(profile, "edit", "providencias", { supabase }),
    can(profile, "publish", "providencias", { supabase }),
    can(profile, "share", "providencias", { supabase }),
    can(profile, "manage", "firmas", { supabase }),
    can(profile, "archive", "providencias", { supabase }),
    can(profile, "restore", "providencias", { supabase }),
    can(profile, "hard_delete", "providencias", { supabase }),
  ]);
  const caseRecord = Array.isArray(proceeding.case)
    ? proceeding.case[0]
    : proceeding.case;
  const dependency = Array.isArray(caseRecord?.dependency) ? caseRecord.dependency[0] : caseRecord?.dependency;
  const formalCaseRecord = { ...caseRecord, dependency_name: dependency?.name || null };
  const originalPdfUrl = proceeding.pdf_path ? `/api/providencias/${id}/pdf?variant=original` : null;
  const combinedPdfUrl = proceeding.pdf_path ? `/api/providencias/${id}/pdf` : null;
  const { data: signatureRows } = await supabase
    .from("signatures")
    .select(
      "id,signer_name,signer_title,signature_image_path,purpose,signed_at,verification_code",
    )
    .eq("target_type", "proceeding")
    .eq("target_id", id)
    .eq("status", "signed")
    .order("signature_order");
  const signatures = await Promise.all(
    (signatureRows ?? []).map(async (s) => ({
      ...s,
      imageUrl:
        (
          await supabase.storage
            .from("signatures")
            .createSignedUrl(s.signature_image_path, 900)
        ).data?.signedUrl ?? null,
    })),
  );
  return (
    <>
      {query.success && <ClearDrafts storageKeys={["sigj:proceeding:new", `sigj:proceeding:${id}`]} />}
      <AdminPageHeader
        title={proceeding.providence_number}
        description={`${proceeding.type} · ${proceeding.status} · ${proceeding.creation_mode === "pdf" ? "PDF" : proceeding.creation_mode === "mixed" ? "Mixta" : "Editor"}`}
        action={
          <div className="flex flex-wrap gap-2">
            {canWrite &&
              !proceeding.archived_at &&
              ["Borrador", "En revisión"].includes(proceeding.status) && (
                <Button asChild variant="outline">
                  <Link href={`/admin/providencias/${id}/editar`}>
                    Editar borrador
                  </Link>
                </Button>
              )}
            {canManageSignatures ? <Button asChild variant="outline">
              <Link href={`/admin/providencias/${id}/firmas`}>
                <PenLine className="size-4" />
                Firmas
              </Link>
            </Button> : <Button variant="outline" disabled title="No tiene permiso para administrar firmas"><PenLine className="size-4" /> Firmas</Button>}
            <PrintButton
              label="Imprimir providencia"
              href={`/imprimir/providencias/${id}`}
            />
            {combinedPdfUrl && (
              <Button asChild>
                <a href={combinedPdfUrl} target="_blank" rel="noreferrer">
                  <FileText className="size-4" /> PDF formal con firmas
                </a>
              </Button>
            )}
          </div>
        }
      />
      <p className="no-print -mt-3 mb-5 text-xs text-muted-foreground">
        Para impresión limpia, desactive encabezados y pies del navegador o use
        el PDF formal cuando esté disponible.
      </p>
      <ActionMessage error={query.error} success={query.success} />
      <FormalProvidenceDocument proceeding={proceeding} caseRecord={formalCaseRecord} signatures={signatures} pdfUrl={originalPdfUrl} combinedPdfUrl={combinedPdfUrl} />
      <div id="firmas">
        <SignaturePanel
          caseId={proceeding.case_id}
          targetType="proceeding"
          targetId={id}
          destination={`/admin/providencias/${id}`}
          signingLink={query.signingLink}
        />
      </div>
      <div className="mt-4 space-y-4 no-print">
        {canShare && <ShareAccessForm
          resourceType="proceeding"
          resourceId={id}
          caseId={proceeding.case_id}
          destination={`/admin/providencias/${id}`}
          users={(users ?? []).map((user) => ({
            id: user.id,
            name: user.full_name,
          }))}
          dependencies={(dependencies ?? []).map((dependency) => ({
            id: dependency.id,
            name: dependency.name,
          }))}
        />}
        <LifecycleActions
          resource="proceedings"
          recordId={id}
          recordLabel={proceeding.providence_number}
          destination="/admin/providencias"
          archived={Boolean(proceeding.archived_at)}
          canArchive={canArchive}
          canRestore={canRestore}
          canHardDelete={canHardDelete}
        />
        {canPublish && proceeding.status !== "Publicado" && !proceeding.archived_at && (
          <form action={publishProceeding}>
            <input type="hidden" name="id" value={proceeding.id} />
            <input type="hidden" name="case_id" value={proceeding.case_id} />
            <ConfirmSubmitButton
              message={
                proceeding.requires_signature
                  ? "¿Publicar esta providencia? Se validará que tenga al menos una firma capturada."
                  : "¿Publicar esta providencia sin requisito de firma?"
              }
            >
              Publicar providencia
            </ConfirmSubmitButton>
          </form>
        )}
      </div>
    </>
  );
}
