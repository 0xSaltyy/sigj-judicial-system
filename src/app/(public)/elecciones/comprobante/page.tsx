"use client";
import { useActionState } from "react";
import { lookupElectionReceipt, type ReceiptLookupState } from "@/app/actions/elections";
import { CopyTextButton } from "@/components/copy-text-button";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { VOTE_STATUS_LABELS, statusLabel } from "@/lib/elections";

export default function ElectionReceiptPage({searchParams}:{searchParams?:Promise<{receipt?:string;state?:string}>}) {
  void searchParams;
  const [state,action]=useActionState<ReceiptLookupState,FormData>(lookupElectionReceipt,{});
  return <main className="mx-auto max-w-3xl px-4 py-10"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#9a752f]">Comprobante electoral</p><h1 className="mt-2 text-3xl font-bold text-[#153553]">Consultar estado del voto</h1><p className="mt-2 text-sm text-muted-foreground">Ingrese el código de comprobante y su usuario/ID de Discord. Por privacidad no se muestra la opción seleccionada.</p><form action={action} className="mt-6 grid gap-4 rounded-xl border bg-white p-5"><label className="grid gap-1 text-sm font-medium">Código de comprobante<Input name="receipt_code" required placeholder="VOTO-2026-XXXXXXXX"/></label><label className="grid gap-1 text-sm font-medium">Usuario o ID de Discord<Input name="discord" required placeholder="Ej. @usuario o 1234567890"/></label><SubmitButton pendingLabel="Consultando…">Consultar</SubmitButton></form>{state.error&&<p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}{state.result&&<section className="mt-6 rounded-xl border bg-white p-5"><p className="text-sm text-muted-foreground">{state.result.electionTitle}</p><div className="mt-2 flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold">{state.result.receiptCode}</span><CopyTextButton text={state.result.receiptCode}/></div><p className="mt-3 font-semibold text-[#153553]">Estado: {statusLabel(VOTE_STATUS_LABELS,state.result.status)}</p><p className="mt-2 text-sm">{state.result.message}</p><p className="mt-3 text-xs text-muted-foreground">Fecha de recepción: {new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(state.result.submittedAt))}</p></section>}</main>;
}
