"use client";
import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { lookupElectionReceipt, type ReceiptLookupState } from "@/app/actions/elections";
import { CopyTextButton } from "@/components/copy-text-button";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VOTE_STATUS_LABELS, statusLabel } from "@/lib/elections";

export function ElectionReceiptLookup({initial}:{initial?:ReceiptLookupState["result"]}) {
  const [state,action]=useActionState<ReceiptLookupState,FormData>(lookupElectionReceipt,{result:initial});
  const result=state.result;
  return <><form action={action} className="mt-6 grid gap-4 rounded-xl border bg-white p-5"><label className="grid gap-1 text-sm font-medium">Código de comprobante<Input name="receipt_code" required placeholder="VOTO-2026-XXXXXXXX"/></label><label className="grid gap-1 text-sm font-medium">Usuario o ID de Discord<Input name="discord" required placeholder="Ej. @usuario o 1234567890"/></label><SubmitButton pendingLabel="Consultando…">Consultar</SubmitButton></form>{state.error&&<p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}{result&&<section className="mt-6 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm"><div className="border-b bg-emerald-50 p-5"><CheckCircle2 className="size-10 text-emerald-700"/><h2 className="mt-3 text-2xl font-semibold text-[#153553]">Voto recibido correctamente</h2><p className="mt-1 text-sm text-emerald-900">Su voto fue recibido correctamente. Guarde este comprobante para consultar el estado de su voto.</p></div><div className="grid gap-5 p-5 sm:grid-cols-2"><Fact label="Elección" value={result.electionTitle}/><Fact label="Estado actual" value={statusLabel(VOTE_STATUS_LABELS,result.status)}/><Fact label="Fecha de recepción" value={new Intl.DateTimeFormat("es-CO",{dateStyle:"long",timeStyle:"short"}).format(new Date(result.submittedAt))}/><Fact label="Usuario Discord registrado" value={result.discordUsername||"Dato validado en consulta"}/><div className="sm:col-span-2 rounded-lg border bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Código de comprobante</p><p className="mt-2 break-all font-mono text-xl font-bold tracking-wide text-[#153553]">{result.receiptCode}</p><div className="mt-3 flex flex-wrap gap-2"><CopyTextButton text={result.receiptCode} label="Copiar código"/><Button asChild variant="outline" size="sm"><Link href="/elecciones/comprobante">Consultar comprobante</Link></Button><Button asChild variant="outline" size="sm"><Link href="/elecciones">Volver a elecciones</Link></Button></div></div><p className="text-sm leading-6 text-muted-foreground sm:col-span-2">{result.message} El comprobante no publica la opción seleccionada.</p></div></section>}</>;
}
function Fact({label,value}:{label:string;value:string}){return <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium text-[#153553]">{value}</p></div>}
