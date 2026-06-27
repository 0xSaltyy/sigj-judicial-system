import Link from "next/link";
import Image from "next/image";
import { saveElection } from "@/app/actions/elections";
import { DraftForm } from "@/components/draft-form";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ELECTION_STATUS_LABELS } from "@/lib/elections";

type Dependency={id:string;name:string;parent_id:string|null};
type Election={id:string;title:string;office:string;territory:string;period:string;round_label:string;institution_id:string|null;status:string;opens_at:string;closes_at:string;description:string;instructions:string|null;ballot_image_path:string|null;total_expected_votes?:number|null};
export function ElectionForm({dependencies,election}:{dependencies:Dependency[];election?:Election}){
  const roots=dependencies.filter((item)=>!item.parent_id);const local=(value?:string|null)=>value?new Date(value).toISOString().slice(0,16):"";
  return <DraftForm action={saveElection} storageKey={`sigj:election:${election?.id??"new"}`} className="grid min-w-0 gap-5 rounded-xl border bg-white p-5 md:grid-cols-2">
    {election&&<input type="hidden" name="election_id" value={election.id}/>}
    <Field label="Título *"><Input name="title" required maxLength={220} defaultValue={election?.title} placeholder="Elección de Gobernador del Departamento del Valle del Cauca 2026"/></Field>
    <Field label="Cargo *"><Input name="office" required maxLength={180} defaultValue={election?.office} placeholder="Gobernador del Departamento del Valle del Cauca"/></Field>
    <Field label="Territorio / jurisdicción *"><Input name="territory" required defaultValue={election?.territory??"Valle del Cauca"}/></Field>
    <Field label="Periodo *"><Input name="period" required defaultValue={election?.period??"2026-2026"}/></Field>
    <Field label="Vuelta *"><Input name="round_label" required defaultValue={election?.round_label??"Primera vuelta"}/></Field>
    <Field label="Institución"><select name="institution_id" defaultValue={election?.institution_id??""} className="h-9 rounded-md border px-3 text-sm"><option value="">Sin institución específica</option>{roots.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Estado"><select name="status" defaultValue={election?.status??"draft"} className="h-9 rounded-md border px-3 text-sm">{Object.entries(ELECTION_STATUS_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
    <Field label="Total esperado para porcentaje público"><Input name="total_expected_votes" type="number" min={1} max={100000000} required defaultValue={election?.total_expected_votes??100}/></Field>
    <Field label="Apertura *"><Input type="datetime-local" name="opens_at" required defaultValue={local(election?.opens_at)}/></Field>
    <Field label="Cierre *"><Input type="datetime-local" name="closes_at" required defaultValue={local(election?.closes_at)}/></Field>
    <div className="md:col-span-2"><p className="mb-2 text-sm font-medium">Tarjeta electoral actual</p>{election?.ballot_image_path?<Image src={election.ballot_image_path} alt="Vista previa de tarjeta electoral" width={768} height={512} className="h-auto max-h-72 w-full rounded border bg-slate-50 object-contain"/>:<p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">Imagen de tarjeta electoral no disponible.</p>}<p className="mt-2 text-xs text-muted-foreground">Las imágenes se gestionan mediante selección/carga controlada. No se editan rutas internas manualmente en este formulario.</p></div>
    <div className="md:col-span-2"><Field label="Descripción *"><Textarea name="description" required className="min-h-28" defaultValue={election?.description}/></Field></div>
    <div className="md:col-span-2"><Field label="Instrucciones"><Textarea name="instructions" className="min-h-24" defaultValue={election?.instructions??""}/></Field></div>
    <p className="text-xs text-muted-foreground md:col-span-2">La apertura, cierre, publicación y declaración de ganador requieren permisos explícitos. Los resultados no se publican automáticamente.</p>
    <div className="flex flex-wrap justify-end gap-3 md:col-span-2"><Button asChild variant="outline"><Link href={election?`/admin/elecciones/${election.id}`:"/admin/elecciones"}>Cancelar</Link></Button><SubmitButton pendingLabel="Guardando…">{election?"Guardar elección":"Crear elección"}</SubmitButton></div>
  </DraftForm>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="grid min-w-0 gap-2 text-sm"><span className="font-medium">{label}</span>{children}</label>}
