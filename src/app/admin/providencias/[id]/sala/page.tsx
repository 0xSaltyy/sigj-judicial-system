import { notFound } from "next/navigation";
import { saveSalaSession } from "@/app/actions/sala";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { inferTemplateStyle } from "@/lib/document-templates";

export default async function SalaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, query, { supabase }] = await Promise.all([params, searchParams, requirePermission(PERMISSIONS.salaView)]);
  const [{ data: proceeding }, { data: current }] = await Promise.all([
    supabase.from("proceedings").select("id,case_id,title,chamber,template_style,case:cases(authority_type,dependency:dependencies(name))").eq("id", id).maybeSingle(),
    supabase.from("sala_sessions").select("*,participants:sala_participants(profile_id,participation,vote)").eq("proceeding_id", id).maybeSingle(),
  ]);
  if (!proceeding) notFound();
  const caseRecord = Array.isArray(proceeding.case) ? proceeding.case[0] : proceeding.case;
  const dependency = Array.isArray(caseRecord?.dependency) ? caseRecord.dependency[0] : caseRecord?.dependency;
  const inferred = inferTemplateStyle([proceeding.template_style, proceeding.chamber, dependency?.name, caseRecord?.authority_type]);
  if (inferred === "juzgado" || inferred === "blank") notFound();
  const { data: magistrates } = await supabase.rpc("list_sala_eligible_profiles", { p_case_id: proceeding.case_id });
  const selected = new Set((current?.participants ?? []).map((item: { profile_id: string }) => item.profile_id));
  return <>
    <AdminPageHeader title="Modo Sala" description={`${proceeding.title} · ${inferred === "corte_suprema" ? "Corte Suprema de Justicia" : "Tribunal Superior"}`} />
    <ActionMessage error={query.error} success={query.success} />
    <form action={saveSalaSession} className="grid gap-5 rounded-xl border bg-white p-6 md:grid-cols-2">
      <input type="hidden" name="session_id" value={current?.id ?? ""} /><input type="hidden" name="case_id" value={proceeding.case_id} /><input type="hidden" name="proceeding_id" value={id} /><input type="hidden" name="institution_style" value={inferred} />
      <Field label="Sala / corporación"><Input name="chamber" defaultValue={current?.chamber ?? proceeding.chamber} required /></Field>
      <Field label="Tipo de sesión"><Input name="session_type" defaultValue={current?.session_type ?? "Sala ordinaria"} required /></Field>
      <Field label={inferred === "corte_suprema" ? "Acta No." : "Acta o referencia de sesión"}><Input name="act_number" defaultValue={current?.act_number ?? ""} /></Field>
      <Field label="Fecha de sesión"><Input type="date" name="session_date" defaultValue={current?.session_date ?? ""} /></Field>
      <Field label="Ponente"><select name="rapporteur_id" defaultValue={current?.rapporteur_id ?? ""} className="h-9 w-full rounded-md border px-3 text-sm"><option value="">Sin asignar</option>{(magistrates ?? []).map((person: { id: string; full_name: string; position_title: string | null }) => <option key={person.id} value={person.id}>{person.full_name} · {person.position_title ?? "Magistratura"}</option>)}</select></Field>
      <Field label="Estado"><select name="status" defaultValue={current?.status ?? "En estudio"} className="h-9 w-full rounded-md border px-3 text-sm">{["En estudio","En sala","Aprobado en sala","Con salvamento/aclaración","Devuelto a ponente","Publicado","Archivado"].map((value) => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Resultado de votación"><Input name="vote_result" defaultValue={current?.vote_result ?? ""} placeholder="Unánime, mayoría, 2–1…" /></Field>
      <Field label="Quórum"><Input type="number" min="0" max="100" name="quorum" defaultValue={current?.quorum ?? ""} /></Field>
      <div className="md:col-span-2"><Label>Magistrados participantes</Label><div className="mt-2 grid gap-2 sm:grid-cols-2">{(magistrates ?? []).map((person: { id: string; full_name: string; position_title: string | null }) => <label key={person.id} className="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" name="participant_ids" value={person.id} defaultChecked={selected.has(person.id)} />{person.full_name}<span className="text-xs text-muted-foreground">{person.position_title}</span></label>)}</div></div>
      <div className="md:col-span-2"><Field label="Observaciones"><Textarea name="observations" defaultValue={current?.observations ?? ""} className="min-h-28" /></Field></div>
      <div className="md:col-span-2 flex justify-end"><SubmitButton pendingLabel="Guardando Sala…">Guardar y auditar</SubmitButton></div>
    </form>
  </>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2 text-sm"><span className="block font-medium">{label}</span>{children}</label>; }
