import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { HearingForm } from "@/components/hearing-form";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
export default async function NewHearing({ searchParams }: { searchParams: Promise<{ caseId?: string; error?: string }> }) { const [{ supabase }, query] = await Promise.all([requirePermission(PERMISSIONS.hearingsCreate), searchParams]); const { data: cases } = await supabase.from("cases").select("id,internal_number").is("archived_at", null).order("filed_at", { ascending: false }).limit(100); return <><AdminPageHeader title="Programar audiencia" description="Cree una sesión vinculada a un expediente." /><ActionMessage error={query.error} /><HearingForm cases={cases ?? []} initialCaseId={query.caseId} /></>; }
