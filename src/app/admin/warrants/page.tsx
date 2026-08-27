import Link from "next/link";
import { Download, Eye, FileText, ScrollText } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { WarrantForm } from "@/components/warrant-form";
import { getWarrantTemplate } from "@/lib/warrants";

type DbWarrant = {
  id: string;
  warrant_number: string;
  warrant_type: string;
  warrant_title: string | null;
  target_description: string;
  status: string;
  confidentiality: string;
  expires_at: string | null;
  case_number: string | null;
};

export const metadata = { title: "Warrants" };

export default async function AdminWarrantsPage({ searchParams }: { searchParams: Promise<{ created?: string; error?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.from("roleplay_warrants").select("id,warrant_number,warrant_type,warrant_title,target_description,status,confidentiality,expires_at,case_number").order("created_at", { ascending: false }).limit(25)
    : { data: null };
  const rows: DbWarrant[] = data ?? [];

  return (
    <>
      <AdminPageHeader title="Warrants" description="Cree borradores guiados, revise la vista formal y genere PDFs con formato de orden judicial en papel Letter." />
      {query.created && <p className="mb-5 rounded-none border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Warrant creado correctamente.</p>}
      {query.error && <p className="mb-5 rounded-none border border-red-200 bg-red-50 p-4 text-sm text-red-900">{query.error}</p>}

      <Card className="mb-6 rounded-none">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base text-[#153553]"><ScrollText className="size-4" /> Crear warrant</CardTitle></CardHeader>
        <CardContent>
          <WarrantForm />
        </CardContent>
      </Card>

      <Card className="rounded-none">
          <CardHeader><CardTitle className="text-base text-[#153553]">Warrants registrados</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {rows.length === 0 ? (
              <div className="grid min-h-40 place-items-center border border-dashed bg-slate-50 p-8 text-center">
                <div>
                  <FileText className="mx-auto size-8 text-slate-400" />
                  <p className="mt-3 text-sm font-semibold text-[#112f4e]">No hay warrants emitidos.</p>
                  <p className="mt-1 text-xs text-slate-600">Cree un borrador con el formulario guiado para iniciar el flujo.</p>
                </div>
              </div>
            ) : null}
            {rows.map((item) => (
              <article key={item.id} className="border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="mono-number text-xs font-semibold text-[#005ea8]">{item.warrant_number}</p>
                    <h2 className="mt-1 text-sm font-semibold text-[#153553]">{item.warrant_title || getWarrantTemplate(item.warrant_type).title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{item.target_description}</p>
                    {item.case_number ? <p className="mono-number mt-1 text-xs text-slate-500">Case No. {item.case_number}</p> : null}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2"><Badge variant="outline" className="rounded-none">{item.status}</Badge><Badge className="rounded-none">{labelConfidentiality(item.confidentiality)}</Badge></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                  <Button asChild size="sm" variant="outline" className="gap-2 rounded-none"><Link href={`/admin/warrants/${item.id}/imprimir`}><Eye className="size-4" /> Vista previa</Link></Button>
                  <Button asChild size="sm" variant="outline" className="gap-2 rounded-none"><Link href={`/api/roleplay/warrants/${item.id}/pdf`}><Download className="size-4" /> Descargar PDF</Link></Button>
                </div>
                <p className="mt-3 border-t pt-3 text-[11px] font-semibold uppercase tracking-wide text-red-800">ROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.</p>
              </article>
            ))}
          </CardContent>
      </Card>
    </>
  );
}

function labelConfidentiality(value: string) {
  return ({ public: "Público", internal: "Interno", reserved: "Reservado", confidential: "Confidencial" } as Record<string, string>)[value] ?? value;
}
