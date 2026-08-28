import Link from "next/link";
import { Search } from "lucide-react";
import { lookupComplaintStatus } from "@/app/actions/complaints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, safeText } from "@/lib/display";

export const metadata = { title: "Estado de denuncia" };

type ComplaintStatus = {
  tracking_number: string;
  status: string;
  category: string;
  reported_subject: string | null;
  submitted_at: string;
  public_updated_at: string | null;
  public_response: string | null;
};

export default async function ComplaintStatusPage({ searchParams }: { searchParams: Promise<{ tracking?: string; code?: string; error?: string }> }) {
  const query = await searchParams;
  const result = query.tracking && query.code ? await fetchStatus(query.tracking, query.code) : null;
  return (
    <div className="bg-[#f5f7f9]">
      <div className="mx-auto max-w-[900px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="border-l-4 border-[#b21b1b] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#5b7287]">Consulta pública</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold text-[#112f4e]">Estado de mi denuncia</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-700">Ingrese el número de denuncia y el código privado recibidos al enviar el formulario.</p>
        </div>
        <form action={lookupComplaintStatus} className="mt-6 grid gap-4 border bg-white p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="tracking_number">Número de denuncia</Label>
            <Input id="tracking_number" name="tracking_number" defaultValue={query.tracking || ""} required className="rounded-none mono-number" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="private_code">Código privado</Label>
            <Input id="private_code" name="private_code" defaultValue={query.code || ""} required className="rounded-none mono-number" />
          </div>
          <Button type="submit" className="rounded-none bg-[#005ea8] hover:bg-[#1a4480]"><Search className="size-4" /> Consultar</Button>
        </form>
        {query.error ? <p className="mt-5 border border-red-200 bg-red-50 p-4 text-sm text-red-900">No se encontró una denuncia con los datos ingresados.</p> : null}
        {result ? (
          <section className="mt-6 border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
              <div>
                <p className="mono-number text-xs font-semibold text-[#005ea8]">{result.tracking_number}</p>
                <h2 className="mt-2 font-serif text-2xl font-semibold text-[#112f4e]">Consulta de denuncia</h2>
              </div>
              <Badge className="rounded-none bg-[#112f4e]">{result.status}</Badge>
            </div>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <Item label="Categoría" value={result.category} />
              <Item label="Reportado" value={safeText(result.reported_subject)} />
              <Item label="Fecha de recepción" value={formatDateTime(result.submitted_at)} />
              <Item label="Última actualización pública" value={formatDateTime(result.public_updated_at)} />
            </dl>
            <div className="mt-6 border bg-slate-50 p-4 text-sm leading-7 text-slate-700">
              <p className="font-semibold text-[#112f4e]">Mensaje público</p>
              <p className="mt-2">{safeText(result.public_response, "No hay mensaje público adicional por el momento.")}</p>
            </div>
          </section>
        ) : null}
        <p className="mt-6 text-sm"><Link href="/denuncias/nueva" className="font-semibold text-[#005ea8] hover:underline">Realizar una nueva denuncia</Link></p>
      </div>
    </div>
  );
}

async function fetchStatus(tracking_number: string, private_code: string): Promise<ComplaintStatus | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("lookup_complaint_status", { p_tracking_number: tracking_number, p_private_code: private_code });
  if (error || !data || data.length === 0) return null;
  return data[0] as ComplaintStatus;
}

function Item({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">{label}</dt><dd className="mt-1 font-medium text-[#112f4e]">{value}</dd></div>;
}
