import { Download } from "lucide-react";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/demo-data";
import { getWarrantTemplate } from "@/lib/warrants";

export const metadata = { title: "Warrants" };

type PublicWarrant = {
  id: string;
  warrant_number: string;
  warrant_type: string;
  warrant_title: string | null;
  target_description: string;
  case_number: string | null;
  status: string;
  expires_at: string | null;
};

export default async function WarrantsPage() {
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.from("roleplay_warrants").select("id,warrant_number,warrant_type,warrant_title,target_description,case_number,status,expires_at").eq("confidentiality", "public").in("status", ["Aprobada", "Activa", "Ejecutada", "Vencida"]).order("created_at", { ascending: false }).limit(25)
    : { data: null };
  const warrants: PublicWarrant[] = data ?? [];

  return (
    <>
      <PageHero
        eyebrow="Warrants"
        title="Órdenes y warrants públicos"
        description="Consulta limitada de órdenes publicadas por las unidades autorizadas."
      />
      <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-4">
          {warrants.length === 0 ? (
            <div className="grid min-h-56 place-items-center border border-dashed bg-white p-8 text-center">
              <div>
                <p className="font-serif text-xl font-semibold text-[#112f4e]">No hay warrants públicos emitidos.</p>
                <p className="mt-2 text-sm text-slate-600">Las órdenes publicadas aparecerán aquí cuando estén disponibles para consulta.</p>
              </div>
            </div>
          ) : null}
          {warrants.map((item) => (
            <article key={item.id} className="reveal border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="mono-number text-xs font-semibold text-[#005ea8]">{item.warrant_number}</p>
                  <h2 className="mt-2 font-serif text-xl font-semibold text-[#102d49]">{item.warrant_title || getWarrantTemplate(item.warrant_type).title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{item.target_description}{item.case_number ? ` · ${item.case_number}` : ""}</p>
                  {item.expires_at ? <p className="mt-2 text-xs text-muted-foreground">Expira: {formatDate(item.expires_at)}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-none">{item.status}</Badge>
                  <Badge className="rounded-none bg-emerald-50 text-emerald-800">Público</Badge>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-slate-600">Documento disponible para consulta pública.</p>
                <Button asChild variant="outline" size="sm" className="gap-2 rounded-none"><Link href={`/api/roleplay/warrants/${item.id}/pdf`}><Download className="size-4" /> Descargar PDF</Link></Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
