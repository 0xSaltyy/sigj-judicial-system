"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { CheckCircle2, ImageOff } from "lucide-react";
import { submitOnlineVote } from "@/app/actions/elections";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BALLOT_ZONES } from "@/lib/elections";

type Option={id:string;candidate_name:string;party_name:string|null;is_blank_vote:boolean;display_order:number};
type Zone={x:number;y:number;w:number;h:number};
type Zones={left?:Zone;center?:Zone;right?:Zone};
export function ElectionBallot({electionId,slug,ballotImage,zones,options}:{electionId:string;slug:string;ballotImage:string|null;zones?:Zones|null;options:Option[]}){
  const [selected,setSelected]=useState<Option|null>(null);
  const ordered=useMemo(()=>[...options].sort((a,b)=>a.display_order-b.display_order),[options]);
  const safeZones={...BALLOT_ZONES,...(zones??{})} as Required<Zones>;
  const zoneFor=(index:number)=>index===0?safeZones.left:index===1?safeZones.center:safeZones.right;
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
    <section className="rounded-xl border bg-white p-3 shadow-sm">
      {!ballotImage?<div className="grid min-h-80 place-items-center rounded-lg border border-dashed bg-slate-50 text-sm text-muted-foreground"><ImageOff className="mb-2 size-8"/>Imagen de tarjeta electoral no disponible.</div>:<div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-lg border bg-slate-100">
        <Image src={ballotImage} alt="Tarjeta electoral interactiva" width={1535} height={1024} className="h-auto w-full select-none" priority/>
        {ordered.slice(0,3).map((option,index)=>{const z=zoneFor(index);const active=selected?.id===option.id;return <button key={option.id} type="button" aria-label={`Seleccionar ${option.candidate_name}`} onClick={()=>setSelected(option)} className={`absolute rounded-md border-2 transition ${active?"border-red-700 bg-red-500/5":"border-transparent hover:border-blue-700/60 hover:bg-blue-500/5"}`} style={{left:`${z.x}%`,top:`${z.y}%`,width:`${z.w}%`,height:`${z.h}%`}}>{active&&<span className="absolute inset-0 grid place-items-center text-[clamp(4rem,13vw,10rem)] font-black leading-none text-red-700/90">X</span>}</button>})}
      </div>}
      <p className="mt-3 text-xs text-muted-foreground">Haga clic sobre una casilla. La marca X aparece centrada en la opción seleccionada; no se interpreta la imagen para contar el voto.</p>
    </section>
    <aside className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-[#153553]">Confirmación del voto</h2>
      <p className="mt-2 text-sm text-muted-foreground">Requerimos su usuario de Discord para validar el voto y evitar duplicados. No será publicado en resultados.</p>
      <div className="mt-4 rounded-lg border bg-slate-50 p-3 text-sm">{selected?<p className="flex items-center gap-2 font-semibold text-[#153553]"><CheckCircle2 className="size-4 text-emerald-700"/>Usted seleccionó: {selected.candidate_name}</p>:<p className="text-muted-foreground">Seleccione una opción en la tarjeta electoral.</p>}</div>
      {selected&&<Button type="button" variant="outline" size="sm" className="mt-3" onClick={()=>setSelected(null)}>Cambiar selección</Button>}
      <form action={submitOnlineVote} className="mt-5 grid gap-3">
        <input type="hidden" name="election_id" value={electionId}/><input type="hidden" name="slug" value={slug}/>{selected&&<input type="hidden" name="option_id" value={selected.id}/>}
        <label className="grid gap-1 text-sm font-medium">Usuario de Discord *<Input name="discord_username" required placeholder="Ej. @usuario o 1234567890"/></label>
        <label className="grid gap-1 text-sm font-medium">Discord ID si lo conoce<Input name="discord_id" placeholder="1234567890"/></label>
        <label className="grid gap-1 text-sm font-medium">Nombre visible<Input name="visible_name" placeholder="Nombre para contacto interno"/></label>
        <label className="grid gap-1 text-sm font-medium">Usuario de Roblox<Input name="roblox_username" placeholder="Opcional"/></label>
        <label className="grid gap-1 text-sm font-medium">Nota de contacto<Textarea name="contact_note" maxLength={500} placeholder="Opcional"/></label>
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Confirme su voto. Después de confirmar, no podrá modificarlo sin revisión autorizada.</p>
        {selected?<SubmitButton pendingLabel="Registrando voto…" className="bg-[#153b5c]" >Confirmar voto</SubmitButton>:<Button type="button" disabled>Seleccione una opción para confirmar</Button>}
      </form>
    </aside>
  </div>;
}
