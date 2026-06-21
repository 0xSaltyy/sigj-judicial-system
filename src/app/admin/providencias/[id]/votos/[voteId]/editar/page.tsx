import { notFound, redirect } from "next/navigation";
import { saveVoteDocument } from "@/app/actions/sala";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function EditVotePage({ params, searchParams }: { params: Promise<{ id: string; voteId: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id, voteId }, query, { supabase, user, profile }] = await Promise.all([params, searchParams, requirePermission(PERMISSIONS.votesEdit)]);
  const { data: vote } = await supabase.from("vote_documents").select("*").eq("id", voteId).eq("proceeding_id", id).maybeSingle();
  if (!vote) notFound();
  if (vote.author_id !== user.id && !profile.is_owner) redirect(`/admin/providencias/${id}/votos/${voteId}?error=Solo%20el%20autor%20puede%20editar%20este%20documento`);
  if (vote.status !== "Borrador") redirect(`/admin/providencias/${id}/votos/${voteId}?error=El%20voto%20firmado%20o%20presentado%20no%20se%20puede%20editar%20sin%20reapertura`);
  return <><AdminPageHeader title="Editar documento del voto particular" description="El borrador puede modificarse hasta su presentación y firma." /><ActionMessage error={query.error} /><form action={saveVoteDocument} className="space-y-5 rounded-xl border bg-white p-6"><input type="hidden" name="vote_id" value={vote.id} /><input type="hidden" name="case_id" value={vote.case_id} /><input type="hidden" name="proceeding_id" value={vote.proceeding_id} /><input type="hidden" name="institution_style" value={vote.institution_style} /><input type="hidden" name="author_user_id" value={vote.author_id} /><div className="grid gap-4 md:grid-cols-2"><Field label="Tipo"><select name="vote_type" defaultValue={vote.vote_type} className="h-9 w-full rounded-md border px-3 text-sm">{["Salvamento de voto","Aclaración de voto","Aclaración parcial","Salvamento parcial","Voto concurrente"].map((value)=><option key={value}>{value}</option>)}</select></Field><Field label="Título"><Input name="title" defaultValue={vote.title} required /></Field><Field label="Visibilidad"><select name="visibility" defaultValue={vote.visibility} className="h-9 w-full rounded-md border px-3 text-sm"><option value="internal">Interna</option><option value="reserved">Reservada</option><option value="public">Pública</option></select></Field></div><div><Label className="mb-2 block">Contenido</Label><MarkdownEditor initialValue={vote.content_markdown} /></div><div className="flex flex-wrap justify-end gap-2"><SubmitButton name="status" value="Borrador" pendingLabel="Guardando…">Guardar borrador</SubmitButton><SubmitButton name="status" value="Presentado" pendingLabel="Presentando…">Presentar voto particular</SubmitButton></div></form></>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2 text-sm"><span className="block font-medium">{label}</span>{children}</label>; }
