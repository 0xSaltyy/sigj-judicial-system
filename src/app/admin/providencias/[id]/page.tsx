import Link from "next/link";
import { notFound } from "next/navigation";
import { publishProceeding } from "@/app/actions/proceedings";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PrintButton } from "@/components/print-button";
import { LifecycleActions } from "@/components/lifecycle-actions";
import {
  JudicialDocumentHeader,
  JudicialPrintFooter,
  JudicialWatermark,
} from "@/components/judicial-document";
import { ShareAccessForm } from "@/components/share-access-form";
import { Button } from "@/components/ui/button";
import { requireInternalUser } from "@/lib/auth/authorization";
import { hasPermission, RESOURCE_ROLES } from "@/lib/auth/permissions";

export default async function ProceedingDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, query, { supabase, profile }] = await Promise.all([
    params,
    searchParams,
    requireInternalUser(),
  ]);
  const [{ data: proceeding }, { data: dependencies }, { data: users }] =
    await Promise.all([
      supabase
        .from("proceedings")
        .select(
          "*,case:cases(internal_number,judicial_number,authority_type,confidentiality_level)",
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
  const canWrite = hasPermission(profile, RESOURCE_ROLES.proceedingsWrite);
  const caseRecord = Array.isArray(proceeding.case)
    ? proceeding.case[0]
    : proceeding.case;
  return (
    <>
      <AdminPageHeader
        title={proceeding.providence_number}
        description={`${proceeding.type} · ${proceeding.status}`}
        action={
          <div className="flex flex-wrap gap-2">
            {canWrite && !proceeding.archived_at && (
              <Button asChild variant="outline">
                <Link href={`/admin/providencias/${id}/editar`}>
                  Editar borrador
                </Link>
              </Button>
            )}
            <PrintButton label="Imprimir providencia" />
          </div>
        }
      />
      <ActionMessage error={query.error} success={query.success} />
      <article className="print-document judicial-document relative rounded-lg border bg-white p-8">
        <JudicialWatermark />
        <JudicialDocumentHeader
          documentType={proceeding.type}
          title={proceeding.title}
          dependency={proceeding.chamber}
          metadata={[
            { label: "Providencia", value: proceeding.providence_number },
            { label: "Radicado", value: caseRecord?.judicial_number },
            { label: "Estado", value: proceeding.status },
            { label: "Reserva", value: caseRecord?.confidentiality_level },
          ]}
        />
        <div className="mt-8">
          <MarkdownViewer content={proceeding.content_markdown} />
        </div>
        <div className="judicial-signature mt-16 grid gap-10 text-center sm:grid-cols-2">
          <div>
            <div className="mx-auto w-56 border-t border-slate-700 pt-2 text-xs">
              Firma responsable
            </div>
          </div>
          <div>
            <div className="mx-auto w-56 border-t border-slate-700 pt-2 text-xs">
              Secretaría
            </div>
          </div>
        </div>
        <JudicialPrintFooter
          verification={`Providencia ${proceeding.providence_number}. Verifique su publicación en el portal institucional.`}
        />
      </article>
      <div className="mt-4 space-y-4 no-print">
        <ShareAccessForm
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
        />
        <LifecycleActions
          resource="proceedings"
          recordId={id}
          recordLabel={proceeding.providence_number}
          destination="/admin/providencias"
          archived={Boolean(proceeding.archived_at)}
          canArchive={canWrite}
          canRestore={profile.is_owner}
          canHardDelete={profile.is_owner}
        />
        {proceeding.status !== "Publicado" && !proceeding.archived_at && (
          <form action={publishProceeding}>
            <input type="hidden" name="id" value={proceeding.id} />
            <input type="hidden" name="case_id" value={proceeding.case_id} />
            <ConfirmSubmitButton message="¿Firmar y publicar esta providencia? Solo será pública si el expediente y la visibilidad lo permiten.">
              Firmar y publicar
            </ConfirmSubmitButton>
          </form>
        )}
      </div>
    </>
  );
}
