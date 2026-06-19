import Link from "next/link";
import { FilePlus2, Printer } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { CaseStatusBadge } from "@/components/status-badges";
import { requireInternalUser } from "@/lib/auth/authorization";
import { formatDate } from "@/lib/demo-data";
export default async function AdminStatesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ supabase }, query] = await Promise.all([requireInternalUser(), searchParams]);
  const { data, error } = await supabase.from("judicial_states").select("id,state_number,state_date,status,dependency:dependencies(name)").order("state_date", { ascending: false });
  return <><AdminPageHeader title="Estados judiciales" description="Creación y publicación real de estados." action={<Button asChild className="bg-[#153b5c]"><Link href="/admin/estados/nuevo"><FilePlus2 className="size-4" /> Crear estado</Link></Button>} /><ActionMessage error={query.error ?? error?.message} success={query.success} /><div className="space-y-3">{(data ?? []).map((state) => <article key={state.id} className="flex justify-between gap-4 rounded-lg border bg-white p-5"><div><p className="mono-number font-semibold">{state.state_number}</p><p className="mt-2 text-sm text-muted-foreground">{state.dependency?.[0]?.name} · {formatDate(state.state_date)}</p></div><div className="flex items-center gap-2"><CaseStatusBadge status={state.status} /><Button asChild variant="outline" size="icon"><Link href={`/estados/${state.id}`} aria-label="Vista imprimible"><Printer className="size-4" /></Link></Button></div></article>)}</div></>;
}
