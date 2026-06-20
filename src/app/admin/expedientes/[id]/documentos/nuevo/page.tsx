import Link from "next/link";
import { ArrowLeft, Archive } from "lucide-react";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { CaseDocumentUploadForm } from "@/components/case-document-upload-form";
import { Button } from "@/components/ui/button";
import { PERMISSIONS, requireCaseAccess } from "@/lib/auth/permissions";

export default async function NewCaseDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; field?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, profile } = await requireCaseAccess(
    id,
    PERMISSIONS.documentsUpload,
  );
  const { data: record } = await supabase
    .from("cases")
    .select("id,internal_number,confidentiality_level,public_visibility,archived_at")
    .eq("id", id)
    .maybeSingle();

  if (!record)
    return <ActionMessage error="Expediente no encontrado o sin acceso." />;

  const ownerCanWriteArchived = profile.is_owner && profile.role === "SUPER_ADMIN";
  const blockedByArchive = Boolean(record.archived_at) && !ownerCanWriteArchived;

  return (
    <>
      <AdminPageHeader
        title="Agregar documento"
        description={`Expediente ${record.internal_number} · Registro privado, validado y auditado.`}
        breadcrumbLabel="Nuevo documento"
        action={
          <Button asChild variant="outline">
            <Link href={`/admin/expedientes/${id}#documentos`}>
              <ArrowLeft className="size-4" /> Volver al expediente
            </Link>
          </Button>
        }
      />
      <ActionMessage error={query.error} />
      {blockedByArchive ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
          <p className="flex items-center gap-2 font-semibold"><Archive className="size-4" /> Expediente archivado</p>
          <p className="mt-2">Solo la cuenta propietaria protegida puede agregar documentos mientras el expediente permanezca archivado.</p>
        </div>
      ) : (
        <CaseDocumentUploadForm
          caseId={id}
          publicEligible={record.confidentiality_level === "Público" && Boolean(record.public_visibility)}
          errorField={query.field}
        />
      )}
    </>
  );
}
