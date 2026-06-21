import { notFound } from "next/navigation";
import { saveVoteDocument } from "@/app/actions/sala";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function EditVotePage({ params, searchParams }: { params: Promise<{ id: string; voteId: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id, voteId }, query, { supabase, user }] = await Promise.all([params, searchParams, requirePermission(PERMISSIONS.votesEdit)]);
  const { data: vote } = await supabase.from("vote_documents").select("*").eq("id", voteId).eq("proceeding_id", id).eq("author_id", user.id).maybeSingle();
  if (!vote || vote.status !== "Borrador") notFound();
  return <><AdminPageHeader title={`Editar ${vote.vote_type.toLowerCase()}`} description="Sólo el autor puede editar el borrador antes de presentarlo y firmarlo." /><ActionMessage error={query.error} /><form action={saveVoteDocument} className="space-y-5 rounded-xl border bg-white p-6"><input type="hidden" name="vote_id" value={vote.id} /><input type="hidden" name="case_id" value={vote.case_id} /><input type="hidden" name="proceeding_id" value={vote.proceeding_id} /><input type="hidden" name="institution_style" value={vote.institution_style} /><div className="grid gap-4 md:grid-cols-2"><Field label="Tipo"><select name="vote_type" defaultValue={vote.vote_type} className="h-9 w-full rounded-md border px-3 text-sm">{["Salvamento de voto","Aclaración de voto","Aclaración parcial","Salvamento parcial","Voto concurrente"].map((value)=><option key={value}>{value}</option>)}</select></Field><Field label="Título"><Input name="title" defaultValue={vote.title} required /></Field><Field label="Estado"><select name="status" defaultValue={vote.status} className="h-9 w-full rounded-md border px-3 text-sm"><option>Borrador</option><option>Presentado</option></select></Field><Field label="Visibilidad"><select name="visibility" defaultValue={vote.visibility} className="h-9 w-full rounded-md border px-3 text-sm"><option value="internal">Interna</option><option value="reserved">Reservada</option><option value="public">Pública</option></select></Field></div><div><Label className="mb-2 block">Contenido</Label><MarkdownEditor initialValue={vote.content_markdown} /></div><div className="flex justify-end"><SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton></div></form></>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2 text-sm"><span className="block font-medium">{label}</span>{children}</label>; }
