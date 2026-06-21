import { notFound } from "next/navigation";
import { saveVoteDocument } from "@/app/actions/sala";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { inferTemplateStyle } from "@/lib/document-templates";

export default async function NewVotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string; error?: string }> }) {
  const [{ id }, query, { supabase }] = await Promise.all([params, searchParams, requirePermission(PERMISSIONS.votesCreate)]);
  const { data: proceeding } = await supabase.from("proceedings").select("id,case_id,title,chamber,template_style,case:cases(authority_type,dependency:dependencies(name))").eq("id", id).maybeSingle();
  if (!proceeding) notFound();
  const caseRecord = Array.isArray(proceeding.case) ? proceeding.case[0] : proceeding.case;
  const dependency = Array.isArray(caseRecord?.dependency) ? caseRecord.dependency[0] : caseRecord?.dependency;
  const style = inferTemplateStyle([proceeding.template_style, proceeding.chamber, dependency?.name, caseRecord?.authority_type]);
  if (style === "juzgado" || style === "blank") notFound();
  const requestedType = ["Salvamento de voto","Aclaración de voto","Aclaración parcial","Salvamento parcial","Voto concurrente"].includes(query.type ?? "") ? query.type! : "Salvamento de voto";
  const roleLabel = style === "corte_suprema" ? "Magistrado/a que salva o aclara voto" : "Magistrado/a disidente o que aclara";
  return <>
    <AdminPageHeader title={requestedType} description={`${roleLabel} · documento separado de la providencia principal`} />
    <ActionMessage error={query.error} />
    <form action={saveVoteDocument} className="space-y-5 rounded-xl border bg-white p-6">
      <input type="hidden" name="case_id" value={proceeding.case_id} /><input type="hidden" name="proceeding_id" value={id} /><input type="hidden" name="institution_style" value={style} />
      <div className="grid gap-4 md:grid-cols-2"><Field label="Tipo"><select name="vote_type" defaultValue={requestedType} className="h-9 w-full rounded-md border px-3 text-sm">{["Salvamento de voto","Aclaración de voto","Aclaración parcial","Salvamento parcial","Voto concurrente"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Título"><Input name="title" defaultValue={`${requestedType} a ${proceeding.title}`} required /></Field><Field label="Estado"><select name="status" defaultValue="Borrador" className="h-9 w-full rounded-md border px-3 text-sm"><option>Borrador</option><option>Presentado</option></select></Field><Field label="Visibilidad"><select name="visibility" defaultValue="internal" className="h-9 w-full rounded-md border px-3 text-sm"><option value="internal">Interna</option><option value="reserved">Reservada</option><option value="public">Pública</option></select></Field></div>
      <div><Label className="mb-2 block">Contenido</Label><MarkdownEditor initialValue={`# ${requestedType.toUpperCase()}\n\n## FUNDAMENTOS\n\n[Exponga las razones del voto particular.]\n\n## CONCLUSIÓN\n\n[Precise el alcance del salvamento o aclaración.]`} /></div>
      <div className="flex justify-end"><SubmitButton pendingLabel="Guardando voto…">Guardar voto particular</SubmitButton></div>
    </form>
  </>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2 text-sm"><span className="block font-medium">{label}</span>{children}</label>; }
