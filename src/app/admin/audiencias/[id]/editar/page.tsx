import { notFound } from "next/navigation";
import { cancelHearing } from "@/app/actions/hearings";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { HearingForm } from "@/components/hearing-form";
import { Input } from "@/components/ui/input";
import { requirePermission, RESOURCE_ROLES } from "@/lib/auth/permissions";
export default async function EditHearing({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) { const [{ id }, query, { supabase }] = await Promise.all([params, searchParams, requirePermission(RESOURCE_ROLES.hearingsWrite)]); const [{ data: hearing }, { data: cases }] = await Promise.all([supabase.from("hearings").select("*").eq("id", id).maybeSingle(), supabase.from("cases").select("id,internal_number").order("filed_at", { ascending: false }).limit(100)]); if (!hearing) notFound(); return <><AdminPageHeader title="Editar audiencia" description="Reprogramación, estado, participantes y cancelación." /><ActionMessage error={query.error} success={query.success} /><HearingForm cases={cases ?? []} hearing={hearing} />{hearing.status !== "Cancelada" && <form action={cancelHearing} className="mt-5 flex max-w-4xl gap-3 rounded-lg border border-red-200 bg-red-50 p-4"><input type="hidden" name="hearing_id" value={hearing.id} /><input type="hidden" name="case_id" value={hearing.case_id} /><Input name="cancellation_reason" required placeholder="Motivo de cancelación" /><ConfirmSubmitButton message="¿Cancelar esta audiencia?" variant="destructive">Cancelar audiencia</ConfirmSubmitButton></form>}</>; }
