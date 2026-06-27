import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveElectionOption } from "@/app/actions/elections";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function ElectionBallotAdmin({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;success?:string}>}){
  const [{id},query,{supabase}]=await Promise.all([params,searchParams,requirePermission(PERMISSIONS.electionsConfigureBallot)]);
  const [{data:election},{data:options}]=await Promise.all([supabase.from("elections").select("id,title,ballot_image_path").eq("id",id).maybeSingle(),supabase.from("election_options").select("*").eq("election_id",id).order("display_order")]);
  if(!election)notFound();
  return <><AdminPageHeader title="Tarjeta electoral" description={election.title} action={<Button asChild variant="outline"><Link href={`/admin/elecciones/${id}`}>Volver</Link></Button>}/><ActionMessage error={query.error} success={query.success}/>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]"><section className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold text-[#153553]">Imagen completa interactiva</h2>{election.ballot_image_path?<Image src={election.ballot_image_path} alt="Tarjeta electoral completa" width={1535} height={1024} className="h-auto w-full rounded border object-contain"/>:<p className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">Imagen de tarjeta electoral no disponible.</p>}<p className="mt-3 text-xs text-muted-foreground">Zonas configuradas: izquierda Barak Obama Junior, centro Antonio Barbosa, derecha Voto en blanco.</p></section><aside className="space-y-4">{options?.map((o)=><form key={o.id} action={saveElectionOption} className="grid gap-3 rounded-xl border bg-white p-4"><input type="hidden" name="option_id" value={o.id}/><input type="hidden" name="election_id" value={id}/><label className="text-sm font-medium">Orden<Input name="display_order" type="number" defaultValue={o.display_order}/></label><label className="text-sm font-medium">Número<Input name="option_number" type="number" defaultValue={o.option_number}/></label><label className="text-sm font-medium">Nombre<Input name="candidate_name" defaultValue={o.candidate_name}/></label><label className="text-sm font-medium">Cargo<Input name="office_label" defaultValue={o.office_label??""}/></label><label className="text-sm font-medium">Movimiento<Input name="party_name" defaultValue={o.party_name??""}/></label><label className="text-sm font-medium">Imagen candidato<Input name="candidate_image_path" defaultValue={o.candidate_image_path??""}/></label><label className="text-sm font-medium">Tarjeta separada<Input name="ballot_card_image_path" defaultValue={o.ballot_card_image_path??""}/></label><input type="hidden" name="is_blank_vote" value={String(o.is_blank_vote)}/><input type="hidden" name="active" value={String(o.active)}/><SubmitButton pendingLabel="Guardando…" size="sm">Guardar opción</SubmitButton></form>)}</aside></div></>;
}
