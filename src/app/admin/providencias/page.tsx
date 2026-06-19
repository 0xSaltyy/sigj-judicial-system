import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseStatusBadge } from "@/components/status-badges";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { requireInternalUser } from "@/lib/auth/authorization";
import { hasPermission, RESOURCE_ROLES } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/demo-data";
export default async function AdminProceedingsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ supabase, profile }, query] = await Promise.all([requireInternalUser(), searchParams]);
  const { data, error } = await supabase.from("proceedings").select("id,providence_number,title,type,chamber,status,created_at,archived_at,case:cases(internal_number)").order("created_at", { ascending: false });
  return <><AdminPageHeader title="Providencias" description="Redacción, revisión, firma y publicación sobre Supabase." action={<Button asChild className="bg-[#153b5c]"><Link href="/admin/providencias/nueva"><Plus className="size-4" /> Nueva providencia</Link></Button>} /><ActionMessage error={query.error ?? error?.message} success={query.success} /><div className="overflow-x-auto rounded-lg border bg-white"><Table><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Tipo / título</TableHead><TableHead>Expediente</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{(data ?? []).map((p) => <TableRow key={p.id} className={p.archived_at ? "bg-slate-50/70" : undefined}><TableCell className="mono-number text-xs">{p.providence_number}</TableCell><TableCell><p className="font-semibold">{p.title}</p><p className="text-xs text-muted-foreground">{p.type} · {p.chamber}</p></TableCell><TableCell className="mono-number text-xs">{p.case?.[0]?.internal_number}</TableCell><TableCell className="text-xs">{formatDate(p.created_at)}</TableCell><TableCell><CaseStatusBadge status={p.status} /></TableCell><TableCell><div className="flex items-center gap-2"><Button asChild size="icon" variant="ghost"><Link href={`/admin/providencias/${p.id}`}><Eye className="size-4" /></Link></Button><LifecycleActions resource="proceedings" recordId={p.id} recordLabel={p.providence_number} destination="/admin/providencias" archived={Boolean(p.archived_at)} canArchive={hasPermission(profile, RESOURCE_ROLES.proceedingsWrite)} canRestore={profile.is_owner} canHardDelete={profile.is_owner} compact /></div></TableCell></TableRow>)}</TableBody></Table>{!data?.length && <p className="p-8 text-center text-sm text-muted-foreground">No hay providencias.</p>}</div></>;
}
