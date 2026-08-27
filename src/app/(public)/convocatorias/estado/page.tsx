import Link from "next/link";
import { Search } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, safeText } from "@/lib/display";

export const metadata = { title: "Estado de mi postulación" };

type Result = { tracking_code: string; tracking_number?: string | null; application_number?: string | null; applicant_name: string; application_type: string; status: string; submitted_at: string; updated_at: string; public_message: string | null };

export default async function ApplicationStatusPage({ searchParams }: { searchParams: Promise<{ tracking?: string; submitted?: string }> }) {
  const query = await searchParams;
  const result = query.tracking ? await lookup(query.tracking) : null;
  return (
    <>
      <PageHero eyebrow="Postulaciones" title="Estado de mi postulación" description="Consulte el estado público usando únicamente su código de seguimiento." />
      <div className="mx-auto max-w-[820px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {query.submitted ? <p className="mb-5 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Postulación recibida correctamente. Guarde este código para futuras consultas.</p> : null}
        <form className="grid gap-3 border bg-white p-5 sm:grid-cols-[1fr_auto]" action="/convocatorias/estado">
          <Input name="tracking" defaultValue={query.tracking || ""} required placeholder="Código de seguimiento" className="mono-number rounded-none" />
          <Button type="submit" className="gap-2 rounded-none bg-[#005ea8]"><Search className="size-4" /> Consultar estado</Button>
        </form>
        {query.tracking && !result ? <p className="mt-5 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No se encontró una postulación con los datos ingresados.</p> : null}
        {result ? <section className="mt-6 border bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4"><div><p className="mono-number text-xs font-semibold text-[#005ea8]">{result.tracking_number || result.tracking_code}</p><h2 className="mt-2 font-serif text-2xl font-semibold text-[#112f4e]">{result.applicant_name}</h2></div><Badge className="rounded-none bg-[#112f4e]">{result.status}</Badge></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><Info label="Número de postulación" value={safeText(result.application_number, "No asignado")} /><Info label="Número de seguimiento" value={result.tracking_number || result.tracking_code} /><Info label="Tipo" value={labelType(result.application_type)} /><Info label="Fecha de postulación" value={formatDateTime(result.submitted_at)} /><Info label="Última actualización" value={formatDateTime(result.updated_at)} /><Info label="Mensaje público" value={safeText(result.public_message, "Sin mensaje público adicional.")} /></dl></section> : null}
        <p className="mt-6 text-sm"><Link href="/postulaciones" className="font-semibold text-[#005ea8] hover:underline">Enviar una nueva postulación</Link></p>
      </div>
    </>
  );
}

async function lookup(tracking: string): Promise<Result | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("lookup_roleplay_application_status", { p_tracking_code: tracking });
  if (error || !data || data.length === 0) return null;
  return data[0] as Result;
}
function labelType(value: string) { return ({ juez: "Postulación a juez", abogado: "Registro de abogado", investigador: "Investigador autorizado", personal: "Personal autorizado" } as Record<string, string>)[value] ?? value; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">{label}</dt><dd className="mt-1 text-[#112f4e]">{value}</dd></div>; }
