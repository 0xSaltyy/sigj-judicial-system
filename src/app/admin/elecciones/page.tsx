import Link from "next/link";
import { Vote } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { ELECTION_STATUS_LABELS, statusLabel } from "@/lib/elections";

export default async function ElectionsAdminPage({searchParams}:{searchParams:Promise<{error?:string;success?:string}>}) {
  const [{supabase,profile},query]=await Promise.all([requirePermission(PERMISSIONS.electionsView),searchParams]);
  const [canCreate,{data:elections,error}]=await Promise.all([can(profile,"crear","elecciones",{supabase}),supabase.from("elections").select("id,slug,title,office,territory,period,round_label,status,opens_at,closes_at,results_published_at,winner_published_at").order("created_at",{ascending:false})]);
  return <><AdminPageHeader title="Elecciones institucionales" description="Configuración, votación, escrutinio y resultados con validación humana." action={canCreate?<Button asChild className="bg-[#153b5c]"><Link href="/admin/elecciones/nueva"><Vote className="size-4"/>Nueva elección</Link></Button>:<Button disabled>Nueva elección</Button>}/><ActionMessage error={query.error??(error?"No fue posible cargar elecciones.":undefined)} success={query.success}/>
    <div className="grid gap-4">{(elections??[]).map((e)=><article key={e.id} className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold text-[#153553]">{e.title}</h2><p className="mt-1 text-sm text-muted-foreground">{e.office} · {e.territory} · {e.period} · {e.round_label}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(e.opens_at)} – {formatDate(e.closes_at)}</p></div><Badge variant="outline">{statusLabel(ELECTION_STATUS_LABELS,e.status)}</Badge></div><div className="mt-4 flex flex-wrap gap-2"><Button asChild size="sm"><Link href={`/admin/elecciones/${e.id}`}>Abrir</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/elecciones/${e.slug}`} target="_blank">Vista pública</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/admin/elecciones/${e.id}/escrutinio`}>Escrutinio</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/admin/elecciones/${e.id}/resultados`}>Resultados</Link></Button></div></article>)}{!elections?.length&&<p className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">No hay elecciones configuradas.</p>}</div></>;
}
function formatDate(value:string){return new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}
