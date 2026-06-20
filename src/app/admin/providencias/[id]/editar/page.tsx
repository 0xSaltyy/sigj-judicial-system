import { notFound } from "next/navigation";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ProvidenceForm, type CaseOption } from "@/components/providence-form";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function EditProceedingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, query, { supabase }] = await Promise.all([params, searchParams, requirePermission(PERMISSIONS.proceedingsEdit)]);
  const [{ data: proceeding }, { data: rows }] = await Promise.all([
    supabase.from("proceedings").select("id,case_id,type,title,chamber,content_markdown,status,visibility,archived_at,creation_mode,providence_date,requires_signature,pdf_original_name,template_key,template_style,document_metadata").eq("id", id).maybeSingle(),
    supabase.from("cases").select("id,internal_number,judicial_number,chamber,authority_type,claimant_name,defendant_name,municipality,dependency:dependencies(name)").is("archived_at", null).order("filed_at", { ascending: false }),
  ]);
  if (!proceeding || proceeding.archived_at) notFound();
  const cases = (rows ?? []).map((item) => ({
    ...item,
    dependency_name: item.dependency?.[0]?.name,
  })) as CaseOption[];
  return (
    <>
      <AdminPageHeader title="Editar providencia" description="Guarde el borrador, revise el formato y publique solo cuando esté listo." />
      <ActionMessage error={query.error} />
      <ProvidenceForm cases={cases} proceeding={proceeding} />
    </>
  );
}
