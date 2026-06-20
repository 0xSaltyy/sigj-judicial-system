import Link from "next/link";
import { createCaseAction } from "@/app/actions/case-actions";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { DraftForm } from "@/components/draft-form";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function NewActionPage({ searchParams }: { searchParams: Promise<{ caseId?: string; error?: string }> }) {
  const [{ supabase }, query] = await Promise.all([requirePermission(PERMISSIONS.actionsCreate), searchParams]);
  const { data: cases } = await supabase.from("cases").select("id,internal_number").is("archived_at", null).order("filed_at", { ascending: false }).limit(100);
  return <><AdminPageHeader title="Nueva actuación" description="Registre una actuación con su visibilidad procesal." /><ActionMessage error={query.error} /><DraftForm action={createCaseAction} storageKey={`sigj:action:${query.caseId ?? "new"}`} className="grid max-w-3xl gap-5 rounded-lg border bg-white p-6"><Field label="Expediente *"><select name="case_id" defaultValue={query.caseId} required className="h-9 rounded-md border px-3 text-sm"><option value="">Seleccione…</option>{(cases ?? []).map((item) => <option key={item.id} value={item.id}>{item.internal_number}</option>)}</select></Field><Field label="Tipo *"><Input name="action_type" required placeholder="Radicación, reparto, traslado…" /></Field><Field label="Título *"><Input name="title" required /></Field><Field label="Descripción *"><Textarea name="description" required className="min-h-32" /></Field><Field label="Visibilidad"><select name="visibility" className="h-9 rounded-md border px-3 text-sm"><option value="internal">Interna</option><option value="public">Pública</option><option value="reserved">Reservada</option></select></Field><div className="flex justify-end gap-3"><Button asChild variant="outline"><Link href="/admin/actuaciones">Cancelar</Link></Button><SubmitButton pendingLabel="Registrando…">Registrar actuación</SubmitButton></div></DraftForm></>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}</div>; }
