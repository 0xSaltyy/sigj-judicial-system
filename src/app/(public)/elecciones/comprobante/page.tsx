import { createClient } from "@/lib/supabase/server";
import { ElectionReceiptLookup } from "@/components/election-receipt-lookup";

export default async function ElectionReceiptPage({searchParams}:{searchParams:Promise<{receipt?:string;discord?:string}>}) {
  const query=await searchParams;const supabase=await createClient();
  const {data}=supabase&&query.receipt&&query.discord?await supabase.rpc("lookup_election_receipt",{p_receipt_code:query.receipt,p_discord:query.discord}):{data:[]};
  const row=data?.[0];
  return <main className="mx-auto max-w-3xl px-4 py-10"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#9a752f]">Comprobante electoral</p><h1 className="mt-2 text-3xl font-bold text-[#153553]">Consultar estado del voto</h1><p className="mt-2 text-sm text-muted-foreground">Ingrese el código de comprobante y su usuario/ID de Discord. Por privacidad no se muestra la opción seleccionada.</p><ElectionReceiptLookup initial={row?{electionTitle:row.election_title,receiptCode:row.receipt_code,submittedAt:row.submitted_at,status:row.status,message:row.public_message,discordUsername:row.discord_username??null}:undefined}/></main>;
}
