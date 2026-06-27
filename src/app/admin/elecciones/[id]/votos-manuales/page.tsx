import Link from "next/link";
import { notFound } from "next/navigation";
import { addManualVoteBatch, reviewManualVoteBatch } from "@/app/actions/elections";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { MANUAL_BATCH_STATUS_LABELS, statusLabel } from "@/lib/elections";

export default async function ManualVotesPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;success?:string}>}){
  const [{id},query,{supabase}]=await Promise.all([params,searchParams,requirePermission(PERMISSIONS.electionsAddManualVotes)]);
  const [{data:election},{data:options},{data:batches}]=await Promise.all([supabase.from("elections").select("id,title").eq("id",id).maybeSingle(),supabase.from("election_options").select("id,candidate_name").eq("election_id",id).eq("active",true).order("display_order"),supabase.from("election_manual_vote_batches").select("id,quantity,source_label,polling_station,witness_name,notes,status,entered_at,selected:election_options(candidate_name)").eq("election_id",id).order("entered_at",{ascending:false})]);
  if(!election)notFound();
  return <><AdminPageHeader title="Votos manuales / físicos" description={election.title} action={<Button asChild variant="outline"><Link href={`/admin/elecciones/${id}`}>Volver</Link></Button>}/><ActionMessage error={query.error} success={query.success}/>
    <form action={addManualVoteBatch} className="mb-5 grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2 xl:grid-cols-4"><input type="hidden" name="election_id" value={id}/><label className="grid gap-1 text-sm font-medium">Opción<select name="option_id" required className="h-9 rounded-md border px-3 text-sm">{options?.map((o)=><option key={o.id} value={o.id}>{o.candidate_name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Cantidad<Input type="number" name="quantity" min={1} required/></label><label className="grid gap-1 text-sm font-medium">Fuente / acta<Input name="source_label" required placeholder="Mesa 01, acta física, testigo…"/></label><label className="grid gap-1 text-sm font-medium">Mesa<Input name="polling_station"/></label><label className="grid gap-1 text-sm font-medium">Testigo<Input name="witness_name"/></label><label className="grid gap-1 text-sm font-medium xl:col-span-2">Notas<Textarea name="notes"/></label><div className="flex items-end"><SubmitButton pendingLabel="Registrando…">Registrar lote pendiente</SubmitButton></div></form>
    <div className="grid gap-3">{batches?.map((b)=><article key={b.id} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{one(b.selected)?.candidate_name??"Opción"} · {b.quantity} voto(s)</p><p className="text-xs text-muted-foreground">{b.source_label} {b.polling_station?`· ${b.polling_station}`:""} {b.witness_name?`· Testigo: ${b.witness_name}`:""}</p></div><Badge variant="outline">{statusLabel(MANUAL_BATCH_STATUS_LABELS,b.status)}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{b.notes||"Sin notas."}</p><div className="mt-3 flex flex-wrap gap-2">{["validated","rejected","annulled"].map((status)=><form key={status} action={reviewManualVoteBatch}><input type="hidden" name="election_id" value={id}/><input type="hidden" name="batch_id" value={b.id}/><input type="hidden" name="status" value={status}/><SubmitButton size="sm" variant="outline" pendingLabel="…">{statusLabel(MANUAL_BATCH_STATUS_LABELS,status)}</SubmitButton></form>)}</div></article>)}{!batches?.length&&<p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">No hay lotes manuales registrados.</p>}</div></>;
}
function one<T>(v:T|T[]|null|undefined):T|null{return Array.isArray(v)?v[0]??null:v??null}
