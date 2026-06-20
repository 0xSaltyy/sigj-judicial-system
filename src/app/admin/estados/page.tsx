import Link from "next/link";
import { FilePlus2, Printer } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { CaseStatusBadge } from "@/components/status-badges";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { can, requirePermission } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/demo-data";

export default async function AdminStatesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { supabase, profile } = await requirePermission({ resource: "estados", action: "view" });
  const [query, canCreate, canArchive, canRestore, canHardDelete] = await Promise.all([searchParams, can(profile, "create", "estados", { supabase }), can(profile, "archive", "estados", { supabase }), can(profile, "restore", "estados", { supabase }), can(profile, "hard_delete", "estados", { supabase })]);
  const { data, error } = await supabase.from("judicial_states").select("id,state_number,state_date,status,archived_at,dependency:dependencies(name)").order("state_date", { ascending: false });
  return <>
    <AdminPageHeader title="Estados judiciales" description="Creación y publicación de estados." action={canCreate ? <Button asChild className="bg-[#153b5c]"><Link href="/admin/estados/nuevo"><FilePlus2 className="size-4" /> Crear estado</Link></Button> : <Button disabled title="No tiene permiso para crear estados judiciales"><FilePlus2 className="size-4" /> Crear estado</Button>} />
    <ActionMessage error={query.error ?? error?.message} success={query.success} />
    <div className="space-y-3">{(data ?? []).map((state) => <article key={state.id} className={`flex flex-col justify-between gap-4 rounded-lg border bg-white p-5 md:flex-row md:items-center ${state.archived_at ? "opacity-75" : ""}`}><div><Link href={`/admin/estados/${state.id}`} className="mono-number font-semibold text-[#153553] hover:underline">{state.state_number}</Link><p className="mt-2 text-sm text-muted-foreground">{state.dependency?.[0]?.name} · {formatDate(state.state_date)}</p></div><div className="flex flex-wrap items-center gap-2"><CaseStatusBadge status={state.status} /><Button asChild variant="outline" size="icon"><Link href={`/estados/${state.id}`} aria-label="Vista imprimible"><Printer className="size-4" /></Link></Button><LifecycleActions resource="judicial_states" recordId={state.id} recordLabel={state.state_number} destination="/admin/estados" archived={Boolean(state.archived_at)} canArchive={canArchive} canRestore={canRestore} canHardDelete={canHardDelete} compact /></div></article>)}</div>
    {!data?.length && <p className="rounded border bg-white p-8 text-center text-sm text-muted-foreground">No hay estados judiciales.</p>}
  </>;
}
