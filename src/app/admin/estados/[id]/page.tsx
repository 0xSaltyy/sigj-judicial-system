import Link from "next/link";
import { notFound } from "next/navigation";
import { addJudicialStateItem, publishJudicialState } from "@/app/actions/states";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function StateDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, query, { supabase, profile }] = await Promise.all([params, searchParams, requirePermission(PERMISSIONS.statesEdit)]);
  const [{ data: state }, { data: items }, { data: cases }] = await Promise.all([
    supabase.from("judicial_states").select("*,dependency:dependencies(name)").eq("id", id).maybeSingle(),
    supabase.from("judicial_state_items").select("id,description,case_id,case:cases(internal_number)").eq("judicial_state_id", id).order("created_at"),
    supabase.from("cases").select("id,internal_number").is("archived_at", null).order("filed_at", { ascending: false }).limit(150),
  ]);
  if (!state) notFound();
  return <><AdminPageHeader title={state.state_number} description={`${state.dependency?.[0]?.name ?? "Dependencia"} · ${state.state_date}`} action={<Button asChild variant="outline"><Link href={`/estados/${id}`}>Vista imprimible</Link></Button>} /><ActionMessage error={query.error} success={query.success} /><div className="grid gap-5 lg:grid-cols-[1fr_360px]"><Card><CardHeader><CardTitle className="text-base">Actuaciones incluidas</CardTitle></CardHeader><CardContent className="space-y-3">{(items ?? []).map((item, index) => <article key={item.id} className="rounded border p-4 text-sm"><p className="mono-number text-xs text-muted-foreground">{index + 1}. {item.case?.[0]?.internal_number}</p><p className="mt-2">{item.description}</p></article>)}{!items?.length && <p className="text-sm text-muted-foreground">El borrador aún no tiene actuaciones.</p>}</CardContent></Card><div className="space-y-4">{state.status !== "Publicado" && !state.archived_at && <Card><CardHeader><CardTitle className="text-base">Agregar actuación</CardTitle></CardHeader><CardContent><form action={addJudicialStateItem} className="space-y-4"><input type="hidden" name="state_id" value={id} /><div className="grid gap-2"><Label htmlFor="case_id">Expediente *</Label><select id="case_id" name="case_id" required className="h-9 rounded-md border px-3 text-sm"><option value="">Seleccione…</option>{(cases ?? []).map((item) => <option key={item.id} value={item.id}>{item.internal_number}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="description">Descripción *</Label><Textarea id="description" name="description" required /></div><SubmitButton pendingLabel="Agregando…">Agregar al estado</SubmitButton></form></CardContent></Card>}{state.status !== "Publicado" && !state.archived_at && <form action={publishJudicialState}><input type="hidden" name="state_id" value={id} /><ConfirmSubmitButton message="¿Publicar este estado? Sus actuaciones serán visibles en el portal público.">Publicar estado</ConfirmSubmitButton></form>}<LifecycleActions resource="judicial_states" recordId={id} recordLabel={state.state_number} destination="/admin/estados" archived={Boolean(state.archived_at)} canArchive canRestore={profile.is_owner} canHardDelete={profile.is_owner} /></div></div></>;
}
