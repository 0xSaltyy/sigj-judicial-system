import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { ProvidenceForm } from "@/components/providence-form";
import { requirePermission, RESOURCE_ROLES } from "@/lib/auth/permissions";
export default async function NewProceedingPage({ searchParams }: { searchParams: Promise<{ caseId?: string; error?: string }> }) { const [{ supabase }, query] = await Promise.all([requirePermission(RESOURCE_ROLES.proceedingsWrite), searchParams]); const { data: cases } = await supabase.from("cases").select("id,internal_number,chamber").is("archived_at", null).order("filed_at", { ascending: false }).limit(100); return <><AdminPageHeader title="Nueva providencia" description="Plantilla, contenido Markdown, firma y publicación con trazabilidad." /><ActionMessage error={query.error} /><ProvidenceForm cases={cases ?? []} initialCaseId={query.caseId} /></>; }
