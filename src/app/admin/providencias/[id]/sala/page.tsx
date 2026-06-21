import Link from "next/link";
import { notFound } from "next/navigation";
import { Gavel, Scale, Users } from "lucide-react";
import { saveSalaSession, saveSalaVoting } from "@/app/actions/sala";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { inferTemplateStyle } from "@/lib/document-templates";

type Person = { id: string; full_name: string; position_title: string | null };
type Participant = { profile_id: string; participation: string; profile: Person | Person[] | null };
type SalaVote = { voter_user_id: string | null; vote_value: string; notes: string | null; announced_opinion_type: string | null; vote_document_id: string | null };

const voteLabels: Record<string, string> = { aprueba: "Aprobó", no_aprueba: "No aprobó", abstencion: "Se abstuvo", ausente: "Ausente", impedido: "Impedido" };

export default async function SalaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, query, session] = await Promise.all([params, searchParams, requirePermission(PERMISSIONS.salaView)]);
  const { supabase, profile } = session;
  const [{ data: proceeding }, { data: current }] = await Promise.all([
    supabase.from("proceedings").select("id,case_id,title,chamber,template_style,archived_at,case:cases(authority_type,dependency:dependencies(name))").eq("id", id).maybeSingle(),
    supabase.from("sala_sessions").select("*,participants:sala_participants(profile_id,participation,profile:profiles!sala_participants_profile_id_fkey(id,full_name,position_title)),votes:sala_votes(voter_user_id,vote_value,notes,announced_opinion_type,vote_document_id)").eq("proceeding_id", id).maybeSingle(),
  ]);
  if (!proceeding || proceeding.archived_at) notFound();
  const caseRecord = Array.isArray(proceeding.case) ? proceeding.case[0] : proceeding.case;
  const dependency = Array.isArray(caseRecord?.dependency) ? caseRecord.dependency[0] : caseRecord?.dependency;
  const inferred = inferTemplateStyle([proceeding.template_style, proceeding.chamber, dependency?.name, caseRecord?.authority_type]);
  if (inferred === "juzgado" || inferred === "blank") notFound();
  const [{ data: magistrates }, canRegisterSession, canRegisterVote, canSend, canApprove, canReturn, canPublish] = await Promise.all([
    supabase.rpc("list_sala_eligible_profiles", { p_case_id: proceeding.case_id }),
    can(profile, "register_session", "sala", { supabase }), can(profile, "register_vote", "sala", { supabase }),
    can(profile, "send", "sala", { supabase }), can(profile, "approve", "sala", { supabase }),
    can(profile, "return", "sala", { supabase }), can(profile, "publish", "sala", { supabase }),
  ]);
  const participants = (current?.participants ?? []) as Participant[];
  const selected = new Set(participants.map((item) => item.profile_id));
  const votesByUser = new Map(((current?.votes ?? []) as SalaVote[]).map((vote) => [vote.voter_user_id, vote]));
  const institutionName = inferred === "corte_suprema" ? "CORTE SUPREMA DE JUSTICIA" : "TRIBUNAL SUPERIOR DE JUSTICIA";
  return <>
    <AdminPageHeader title="Votación de Sala" description={`${institutionName} · ${proceeding.title}`} action={<Button asChild variant="outline"><Link href={`/admin/providencias/${id}`}>Volver a la providencia</Link></Button>} />
    <ActionMessage error={query.error} success={query.success} />
    {!current && <Card className="mb-6 border-dashed"><CardContent className="py-10 text-center"><Gavel className="mx-auto size-8 text-muted-foreground"/><h2 className="mt-3 font-semibold">No hay sesión de Sala registrada para esta providencia.</h2><p className="mt-1 text-sm text-muted-foreground">Cree la sesión antes de registrar la votación nominal.</p>{!canRegisterSession&&<p className="mt-3 text-sm text-amber-800">No tiene permiso para crear sesiones de Sala.</p>}</CardContent></Card>}
    {canRegisterSession ? <Card className="mb-6"><CardHeader><CardTitle className="flex items-center gap-2"><Gavel className="size-5"/>{current ? "Sesión de Sala" : "Crear sesión de Sala"}</CardTitle></CardHeader><CardContent><form action={saveSalaSession} className="grid gap-5 md:grid-cols-2">
      <input type="hidden" name="session_id" value={current?.id ?? ""}/><input type="hidden" name="case_id" value={proceeding.case_id}/><input type="hidden" name="proceeding_id" value={id}/><input type="hidden" name="institution_style" value={inferred}/>
      <Field label="Sala / corporación"><Input name="chamber" defaultValue={current?.chamber ?? proceeding.chamber} required/></Field><Field label="Tipo de sesión"><Input name="session_type" defaultValue={current?.session_type ?? "Sala ordinaria"} required/></Field>
      <Field label={inferred === "corte_suprema" ? "Aprobado Acta No." : "Acta o referencia de sesión"}><Input name="act_number" defaultValue={current?.act_number ?? ""}/></Field><Field label="Fecha de sesión"><Input type="date" name="session_date" defaultValue={current?.session_date ?? ""}/></Field>
      <Field label={inferred === "corte_suprema" ? "Magistrado/a Ponente" : "Magistrado/a Sustanciador/a o Ponente"}><select name="rapporteur_id" defaultValue={current?.rapporteur_id ?? ""} className="h-9 w-full rounded-md border px-3 text-sm"><option value="">Sin asignar</option>{(magistrates ?? []).map((person: Person)=><option key={person.id} value={person.id}>{person.full_name} · {person.position_title ?? "Magistratura"}</option>)}</select></Field><Field label="Quórum"><Input type="number" min="0" max="100" name="quorum" defaultValue={current?.quorum ?? ""}/></Field>
      <div className="md:col-span-2"><Label>Magistrados participantes</Label><div className="mt-2 grid gap-2 sm:grid-cols-2">{(magistrates ?? []).map((person: Person)=><label key={person.id} className="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" name="participant_ids" value={person.id} defaultChecked={selected.has(person.id)}/><span>{person.full_name}<small className="ml-2 text-muted-foreground">{person.position_title ?? "Magistrado/a"}</small></span></label>)}</div></div>
      <div className="md:col-span-2"><Field label="Observaciones de la sesión"><Textarea name="observations" defaultValue={current?.observations ?? ""} className="min-h-24"/></Field></div>
      <div className="md:col-span-2 flex flex-wrap justify-end gap-2"><SubmitButton name="intent" value="save_session" variant="outline" pendingLabel="Guardando…">{current ? "Guardar sesión" : "Crear sesión de Sala"}</SubmitButton>{current&&canSend&&<SubmitButton name="intent" value="send_to_sala" pendingLabel="Enviando…">Enviar a Sala</SubmitButton>}{current&&canReturn&&<SubmitButton name="intent" value="return" variant="outline" pendingLabel="Devolviendo…">Devolver a ponente</SubmitButton>}{current&&canApprove&&<ConfirmSubmitButton name="intent" value="approve" message="¿Aprobar la decisión principal con la votación nominal registrada?">Aprobar en Sala</ConfirmSubmitButton>}{current&&canPublish&&<ConfirmSubmitButton name="intent" value="publish" message="¿Publicar la decisión aprobada por la Sala?">Publicar decisión</ConfirmSubmitButton>}</div>
    </form></CardContent></Card> : null}
    {current ? <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Scale className="size-5"/>Registro nominal de la Votación de Sala</CardTitle><p className="mt-1 text-sm text-muted-foreground">Responde si la providencia principal fue aprobada. No contiene el texto de salvamentos o aclaraciones.</p></div><Badge>{current.status}</Badge></div></CardHeader><CardContent>
      {current.vote_result&&<div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Resultado de votación</p><p className="mt-1 text-sm text-emerald-950">{current.vote_result}</p></div>}
      {!participants.length ? <div className="rounded border border-dashed p-8 text-center"><Users className="mx-auto size-7 text-muted-foreground"/><p className="mt-2 text-sm">No hay magistrados participantes. Agréguelos en la sesión.</p></div> : canRegisterVote ? <form action={saveSalaVoting}><input type="hidden" name="session_id" value={current.id}/><input type="hidden" name="case_id" value={proceeding.case_id}/><input type="hidden" name="proceeding_id" value={id}/><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-3">Magistrado/a</th><th className="p-3">Cargo</th><th className="p-3">Voto</th><th className="p-3">Observación</th><th className="p-3">¿Tiene voto particular?</th></tr></thead><tbody>{participants.map((participant)=>{const person=Array.isArray(participant.profile)?participant.profile[0]:participant.profile;const saved=votesByUser.get(participant.profile_id);return <tr key={participant.profile_id} className="border-b align-top"><td className="p-3 font-medium"><input type="hidden" name="voter_ids" value={participant.profile_id}/>{person?.full_name??"Magistrado/a no disponible"}</td><td className="p-3 text-muted-foreground">{person?.position_title??"Magistrado/a"}</td><td className="p-3"><select name={`vote_value_${participant.profile_id}`} defaultValue={saved?.vote_value??"aprueba"} className="h-9 rounded-md border px-2">{Object.entries(voteLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></td><td className="p-3"><Input name={`notes_${participant.profile_id}`} defaultValue={saved?.notes??""} placeholder="Observación opcional"/></td><td className="p-3"><select name={`opinion_type_${participant.profile_id}`} defaultValue={saved?.announced_opinion_type??""} className="h-9 w-full rounded-md border px-2"><option value="">No</option><option value="salvamento">Sí · Salvamento de voto</option><option value="aclaracion">Sí · Aclaración de voto</option><option value="salvamento_parcial">Sí · Salvamento parcial</option><option value="aclaracion_parcial">Sí · Aclaración parcial</option><option value="concurrente">Sí · Voto concurrente</option></select>{saved?.vote_document_id&&<Link href={`/admin/providencias/${id}/votos/${saved.vote_document_id}`} className="mt-1 block text-xs font-semibold text-[#153b5c]">Abrir documento vinculado</Link>}</td></tr>})}</tbody></table></div><div className="mt-5 flex justify-end"><ConfirmSubmitButton message="¿Guardar la votación nominal? Los anuncios de salvamento o aclaración crearán borradores vinculados.">Registrar votación</ConfirmSubmitButton></div></form> : <p className="rounded border bg-slate-50 p-4 text-sm text-muted-foreground">Puede consultar la Votación de Sala, pero no tiene permiso para registrarla.</p>}
      {!current.vote_result&&participants.length>0&&<p className="mt-4 rounded border border-dashed p-4 text-sm text-muted-foreground">No se ha registrado la votación de Sala.</p>}
    </CardContent></Card> : null}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2 text-sm"><span className="block font-medium">{label}</span>{children}</label>; }
