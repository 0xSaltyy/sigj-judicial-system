import Image from "next/image";
import { notFound } from "next/navigation";
import { publishProceeding } from "@/app/actions/proceedings";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PrintButton } from "@/components/print-button";
import { requireInternalUser } from "@/lib/auth/authorization";

export default async function ProceedingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, query, { supabase }] = await Promise.all([params, searchParams, requireInternalUser()]);
  const { data: proceeding } = await supabase.from("proceedings").select("*,case:cases(internal_number,judicial_number,authority_type)").eq("id", id).maybeSingle();
  if (!proceeding) notFound();
  return <><AdminPageHeader title={proceeding.providence_number} description={`${proceeding.type} · ${proceeding.status}`} action={<PrintButton label="Imprimir providencia" />} /><ActionMessage error={query.error} success={query.success} /><article className="print-document rounded-lg border bg-white p-8"><header className="text-center"><Image src="/escudo-institucional.png" alt="Escudo institucional de Colombia" width={72} height={72} className="mx-auto size-[72px] object-contain" /><p className="mt-4 text-xs uppercase tracking-widest">{proceeding.chamber}</p><h1 className="mt-4 text-xl font-bold">{proceeding.title}</h1><p className="mono-number mt-2 text-sm">{proceeding.providence_number}</p></header><div className="mt-8"><MarkdownViewer content={proceeding.content_markdown} /></div></article>{proceeding.status !== "Publicado" && <form action={publishProceeding} className="mt-4 no-print"><input type="hidden" name="id" value={proceeding.id} /><input type="hidden" name="case_id" value={proceeding.case_id} /><ConfirmSubmitButton message="¿Firmar y publicar esta providencia?">Firmar y publicar</ConfirmSubmitButton></form>}</>;
}
