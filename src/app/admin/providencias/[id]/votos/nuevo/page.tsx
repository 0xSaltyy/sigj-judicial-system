import Link from "next/link";
import { notFound } from "next/navigation";
import { saveVoteDocument } from "@/app/actions/sala";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { inferTemplateStyle } from "@/lib/document-templates";

const voteTypes = ["Salvamento de voto", "Aclaración de voto", "Salvamento parcial", "Aclaración parcial", "Voto concurrente"];
function starter(type: string) {
  return type.startsWith("Salvamento")
    ? `# SALVAMENTO DE VOTO\n\nCon el respeto acostumbrado por la decisión mayoritaria de la Sala, me permito salvar voto por las siguientes razones:\n\n## I. ANTECEDENTES\n\n## II. RAZONES DEL SALVAMENTO\n\n## III. CONCLUSIÓN\n\nFirma`
    : `# ACLARACIÓN DE VOTO\n\nAunque comparto la decisión adoptada por la Sala, estimo necesario aclarar mi voto en los siguientes términos:\n\n## I. PRECISIÓN INICIAL\n\n## II. RAZONES DE LA ACLARACIÓN\n\n## III. CONCLUSIÓN\n\nFirma`;
}

export default async function NewVotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string; error?: string }> }) {
  const [{ id }, query, { supabase, profile }] = await Promise.all([params, searchParams, requirePermission(PERMISSIONS.votesCreate)]);
  const { data: proceeding } = await supabase.from("proceedings").select("id,case_id,title,chamber,template_style,case:cases(authority_type,assigned_judge_id,dependency:dependencies(name)),sala:sala_sessions(id,participants:sala_participants(profile_id))").eq("id", id).maybeSingle();
  if (!proceeding) notFound();
  const caseRecord = Array.isArray(proceeding.case) ? proceeding.case[0] : proceeding.case;
  const dependency = Array.isArray(caseRecord?.dependency) ? caseRecord.dependency[0] : caseRecord?.dependency;
  const style = inferTemplateStyle([proceeding.template_style, proceeding.chamber, dependency?.name, caseRecord?.authority_type]);
  if (style === "juzgado" || style === "blank") notFound();
  const sala = Array.isArray(proceeding.sala) ? proceeding.sala[0] : proceeding.sala;
  const participantIds = new Set((sala?.participants ?? []).map((item: { profile_id: string }) => item.profile_id));
  const { data: eligible } = await supabase.rpc("list_sala_eligible_profiles", { p_case_id: proceeding.case_id });
  const authors = (eligible ?? []).filter((person: { id: string }) => profile.is_owner ? participantIds.has(person.id) || caseRecord?.assigned_judge_id === person.id : person.id === profile.id && (participantIds.has(person.id) || caseRecord?.assigned_judge_id === person.id));
  const requestedType = voteTypes.includes(query.type ?? "") ? query.type! : "Salvamento de voto";
  const author = authors[0];
  const wording = style === "corte_suprema" ? "CORTE SUPREMA DE JUSTICIA · Magistrado/a que salva o aclara voto" : "TRIBUNAL SUPERIOR DE JUSTICIA · Magistrado/a disidente o que aclara";
  return <>
    <AdminPageHeader title={`Nuevo documento · ${requestedType}`} description={`${wording} · escrito separado de la providencia principal`} action={<Button asChild variant="outline"><Link href={`/admin/providencias/${id}`}>Cancelar</Link></Button>} />
    <ActionMessage error={query.error} />
    {!authors.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">No puede crear un voto particular porque su cuenta no figura como participante de la Sala ni como ponente de esta decisión.</div> : <form action={saveVoteDocument} className="space-y-5 rounded-xl border bg-white p-6">
      <input type="hidden" name="case_id" value={proceeding.case_id}/><input type="hidden" name="proceeding_id" value={id}/><input type="hidden" name="institution_style" value={style}/>
      <div className="rounded border bg-slate-50 p-4 text-sm"><b>Relacionado con providencia:</b> {proceeding.title}</div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Tipo de voto particular"><select name="vote_type" defaultValue={requestedType} className="h-9 w-full rounded-md border px-3 text-sm">{voteTypes.map((value)=><option key={value}>{value}</option>)}</select></Field><Field label="Autor"><select name="author_user_id" defaultValue={author?.id} className="h-9 w-full rounded-md border px-3 text-sm">{authors.map((person: { id: string; full_name: string; position_title: string | null })=><option key={person.id} value={person.id}>{person.full_name} · {person.position_title ?? "Magistrado/a"}</option>)}</select></Field><Field label="Título"><Input name="title" defaultValue={`${requestedType} de ${author?.full_name ?? "la magistratura"}`} required/></Field><Field label="Visibilidad"><select name="visibility" defaultValue="internal" className="h-9 w-full rounded-md border px-3 text-sm"><option value="internal">Interna</option><option value="reserved">Reservada</option><option value="public">Pública al publicarse</option></select></Field></div>
      <div><Label className="mb-2 block">Documento del voto particular</Label><MarkdownEditor initialValue={starter(requestedType)}/></div>
      <div className="flex flex-wrap justify-end gap-2"><SubmitButton name="status" value="Borrador" variant="outline" pendingLabel="Guardando…">Guardar borrador</SubmitButton><SubmitButton name="status" value="Presentado" pendingLabel="Presentando…">Presentar voto particular</SubmitButton></div>
    </form>}
  </>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2 text-sm"><span className="block font-medium">{label}</span>{children}</label>; }
