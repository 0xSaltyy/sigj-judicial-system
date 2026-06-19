import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { CaseStatusBadge } from "@/components/status-badges";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { requireInternalUser } from "@/lib/auth/authorization";
import { hasPermission, RESOURCE_ROLES } from "@/lib/auth/permissions";

export default async function AdminNotices({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ supabase, profile }, query] = await Promise.all([requireInternalUser(), searchParams]);
  const { data, error } = await supabase.from("public_notices").select("*").order("created_at", { ascending: false });
  return <>
    <AdminPageHeader title="Comunicados" description="Gestión editorial y publicación institucional." action={<Button asChild className="bg-[#153b5c]"><Link href="/admin/comunicados/nuevo"><Plus className="size-4" /> Nuevo comunicado</Link></Button>} />
    <ActionMessage error={query.error ?? error?.message} success={query.success} />
    <div className="space-y-3">{(data ?? []).map((notice) => <article key={notice.id} className={`flex flex-col justify-between gap-4 rounded-lg border bg-white p-5 md:flex-row md:items-center ${notice.archived_at ? "opacity-75" : ""}`}><div><Link href={`/admin/comunicados/${notice.id}/editar`} className="font-semibold text-[#153553] hover:underline">{notice.title}</Link><p className="mt-1 text-xs text-muted-foreground">/{notice.slug} · {notice.issuing_entity}</p></div><div className="flex flex-wrap items-center gap-2"><CaseStatusBadge status={notice.status} /><LifecycleActions resource="public_notices" recordId={notice.id} recordLabel={notice.title} destination="/admin/comunicados" archived={Boolean(notice.archived_at)} canArchive={hasPermission(profile, RESOURCE_ROLES.noticesWrite)} canRestore={profile.is_owner} canHardDelete={profile.is_owner} compact /></div></article>)}</div>
    {!data?.length && <p className="rounded border bg-white p-8 text-center text-sm text-muted-foreground">No hay comunicados.</p>}
  </>;
}
