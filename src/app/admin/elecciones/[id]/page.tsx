import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleAlert, Clock3, Vote } from "lucide-react";
import { AdminPageHeader, MetricCard } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { ElectionForm } from "@/components/election-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { ELECTION_STATUS_LABELS, VOTE_STATUS_LABELS, statusLabel } from "@/lib/elections";

export default async function ElectionDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;success?:string}>}){
  const [{id},query,{supabase,profile}]=await Promise.all([params,searchParams,requirePermission(PERMISSIONS.electionsView)]);
  const [{data:election},{data:options},{data:dependencies},{data:territorial},canEdit]=await Promise.all([
    supabase.from("elections").select("*").eq("id",id).maybeSingle(),
    supabase.from("election_options").select("*").eq("election_id",id).order("display_order"),
    supabase.from("dependencies").select("id,name,parent_id").eq("is_active",true).is("archived_at",null).order("name"),
    supabase.from("election_territorial_results").select("validation_status,published_at,counted_percentage").eq("election_id",id),
    can(profile,"editar","elecciones",{supabase}),
  ]);
  if(!election)notFound();
  const {data:votes}=await supabase.from("election_votes").select("status,source").eq("election_id",id);
  const count=(status:string)=>votes?.filter((v)=>v.status===status).length??0;
  const territorialCount=(status:string)=>territorial?.filter((zone)=>zone.validation_status===status).length??0;
  const hasValidatedUnpublished=Boolean(territorial?.some((zone)=>zone.validation_status==="validated"&&!zone.published_at));
  const validatedProgress=Math.max(0,...(territorial??[]).filter((zone)=>["validated","published"].includes(zone.validation_status)).map((zone)=>Number(zone.counted_percentage)||0));
  return <><AdminPageHeader title={election.title} description={`${election.office} · ${statusLabel(ELECTION_STATUS_LABELS,election.status)}`} action={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/admin/elecciones">Volver</Link></Button><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}/tarjeta`}>Tarjeta</Link></Button><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}/escrutinio`}>Escrutinio</Link></Button><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}/mapa`}>Mapa</Link></Button><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}/actualizaciones`}>Actualizaciones</Link></Button><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}/acta`}>Acta</Link></Button><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}/pantalla`} target="_blank">Pantalla</Link></Button><Button asChild variant="outline"><Link href={`/elecciones/${election.slug}`} target="_blank">Pública</Link></Button></div>}/><ActionMessage error={query.error} success={query.success}/>
    {(territorialCount("pending_submission")>0||territorialCount("submitted")>0||territorialCount("pending_validation")>0||territorialCount("rejected")>0||hasValidatedUnpublished||validatedProgress>=100)&&<section className="mb-5 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      {territorialCount("pending_submission")>0&&<p>Hay municipios con datos guardados sin enviar o devueltos a corrección.</p>}
      {(territorialCount("submitted")+territorialCount("pending_validation"))>0&&<p>Hay datos enviados al escrutinio pendientes de validación.</p>}
      {territorialCount("rejected")>0&&<p>Existen votos territoriales rechazados.</p>}
      {hasValidatedUnpublished&&<p>Hay municipios validados no incluidos en la última actualización pública.</p>}
      {validatedProgress>=100&&<p>El avance llegó al 100%; revise el acta electoral.</p>}
    </section>}
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Votos online" value={String(votes?.filter((v)=>v.source==="online").length??0)} detail="Recibidos por portal" icon={<Vote className="size-5"/>}/><MetricCard label="Pendientes" value={String(count("pending_validation")+count("observed"))} detail="Requieren revisión" icon={<Clock3 className="size-5"/>}/><MetricCard label="Válidos" value={String(count("valid"))} detail="Online validados" icon={<CheckCircle2 className="size-5"/>}/><MetricCard label="Anulados/rechazados" value={String(count("annulled")+count("rejected")+count("duplicate"))} detail="No cuentan en resultados" icon={<CircleAlert className="size-5"/>}/></div>
    <section className="mb-5 rounded-xl border bg-white p-4">
      <h2 className="font-semibold text-[#153553]">Flujo simplificado de la elección</h2>
      <div className="mt-3 grid gap-2 md:grid-cols-4 xl:grid-cols-8">{[
        ["Configurar",`/admin/elecciones/${id}`,"Datos, estado y total esperado"],
        ["Tarjeta",`/admin/elecciones/${id}/tarjeta`,"Opciones electorales"],
        ["Votos online",`/admin/elecciones/${id}/votos`,"Recepción y control"],
        ["Territoriales",`/admin/elecciones/${id}/mapa`,"Municipios y conteos"],
        ["Escrutinio",`/admin/elecciones/${id}/escrutinio`,"Validación humana"],
        ["Resultados",`/admin/elecciones/${id}/resultados`,"Actualizar/publicar"],
        ["Acta",`/admin/elecciones/${id}/acta`,"Documento verificable"],
        ["Auditoría",`/admin/elecciones/${id}/auditoria`,"Trazabilidad"],
      ].map(([label,href,detail])=><Link key={href} href={href} className="rounded-lg border bg-slate-50 p-3 text-xs transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"><span className="block font-semibold text-[#153553]">{label}</span><span className="mt-1 block text-muted-foreground">{detail}</span></Link>)}</div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><section>{canEdit?<ElectionForm dependencies={dependencies??[]} election={election}/>:<p className="rounded-xl border bg-white p-5 text-sm text-muted-foreground">Consulta únicamente; no tiene permiso para editar esta elección.</p>}</section><aside className="space-y-4 rounded-xl border bg-white p-5"><h2 className="font-semibold text-[#153553]">Opciones</h2>{options?.map((o)=><div key={o.id} className="rounded border p-3 text-sm"><p className="font-semibold">{o.candidate_name}</p><p className="text-xs text-muted-foreground">{o.party_name||"Sin movimiento"} {o.is_blank_vote?"· Voto en blanco":""}</p></div>)}<Badge variant="outline">{statusLabel(VOTE_STATUS_LABELS,"pending_validation")} antes de contar</Badge><Button asChild className="w-full"><Link href={`/admin/elecciones/${id}/resultados`}>Ver resultados</Link></Button></aside></div></>;
}
