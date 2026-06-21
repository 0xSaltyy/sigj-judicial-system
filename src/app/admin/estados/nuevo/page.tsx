import { createJudicialState } from "@/app/actions/states";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { DraftForm } from "@/components/draft-form";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function NewState({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ supabase }, query] = await Promise.all([requirePermission(PERMISSIONS.statesCreate), searchParams]);
  const [{ data: dependencies }, { data: cases }] = await Promise.all([supabase.from("dependencies").select("id,name").eq("is_active", true).order("name"), supabase.from("cases").select("id,internal_number").is("archived_at", null).order("filed_at", { ascending: false }).limit(100)]);
  return <><AdminPageHeader title="Crear estado judicial" description="Puede guardar el estado como borrador y agregar actuaciones antes de publicarlo." /><ActionMessage error={query.error} /><DraftForm action={createJudicialState} storageKey="sigj:state:new" className="grid max-w-3xl gap-5 rounded-lg border bg-white p-6"><Field label="Dependencia *"><select name="dependency_id" required className="h-9 rounded-md border px-3"><option value="">Seleccione…</option>{(dependencies ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Fecha *"><Input name="state_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field><Field label="Expediente (opcional en borrador)"><select name="case_id" className="h-9 rounded-md border px-3"><option value="">Agregar después…</option>{(cases ?? []).map((item) => <option key={item.id} value={item.id}>{item.internal_number}</option>)}</select></Field><Field label="Descripción (opcional en borrador)"><Textarea name="description" /></Field><Field label="Estado"><select name="status" className="h-9 rounded-md border px-3"><option>Borrador</option><option>Publicado</option></select></Field><SubmitButton pendingLabel="Creando…">Guardar estado</SubmitButton></DraftForm></>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm"><span className="font-medium">{label}</span>{children}</label>; }
