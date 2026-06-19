import { notFound } from "next/navigation";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ProvidenceForm } from "@/components/providence-form";
import { requireInternalUser } from "@/lib/auth/authorization";

export default async function EditProceedingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, query, { supabase }] = await Promise.all([params, searchParams, requireInternalUser()]);
  const [{ data: proceeding }, { data: cases }] = await Promise.all([
    supabase.from("proceedings").select("id,case_id,type,title,chamber,content_markdown,status,visibility,archived_at").eq("id", id).maybeSingle(),
    supabase.from("cases").select("id,internal_number,chamber").is("archived_at", null).order("filed_at", { ascending: false }),
  ]);
  if (!proceeding || proceeding.archived_at) notFound();
  return <><AdminPageHeader title="Editar providencia" description="Guarde el borrador, revise el contenido y publique solo cuando esté listo." /><ActionMessage error={query.error} /><ProvidenceForm cases={cases ?? []} proceeding={proceeding} /></>;
}
