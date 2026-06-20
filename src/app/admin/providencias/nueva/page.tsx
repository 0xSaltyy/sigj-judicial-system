import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ProvidenceForm, type CaseOption } from "@/components/providence-form";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function NewProceedingPage({ searchParams }: { searchParams: Promise<{ caseId?: string; error?: string }> }) {
  const [{ supabase }, query] = await Promise.all([requirePermission(PERMISSIONS.proceedingsCreate), searchParams]);
  const { data: rows } = await supabase
    .from("cases")
    .select("id,internal_number,judicial_number,chamber,authority_type,claimant_name,defendant_name,municipality,dependency:dependencies(name)")
    .is("archived_at", null)
    .order("filed_at", { ascending: false })
    .limit(100);
  const cases = (rows ?? []).map((item) => ({
    ...item,
    dependency_name: item.dependency?.[0]?.name,
  })) as CaseOption[];
  return (
    <>
      <AdminPageHeader title="Nueva providencia" description="Redacción institucional, PDF, firma manuscrita y publicación con trazabilidad." />
      <ActionMessage error={query.error} />
      <ProvidenceForm cases={cases} initialCaseId={query.caseId} />
    </>
  );
}
