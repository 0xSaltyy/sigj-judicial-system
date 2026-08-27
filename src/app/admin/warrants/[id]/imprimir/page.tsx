import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { WarrantDocument } from "@/components/warrant-document";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { normalizeWarrantData } from "@/lib/warrants";

export const metadata = { title: "Vista previa de warrant" };

export default async function WarrantPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data } = await supabase.from("roleplay_warrants").select("*").eq("id", id).single();
  if (!data) notFound();
  const documentData = normalizeWarrantData({ ...(typeof data.document_data === "object" && data.document_data ? data.document_data : {}), ...data });

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-5 flex max-w-[816px] flex-wrap justify-between gap-3">
        <Button asChild variant="outline" className="rounded-none"><Link href="/admin/warrants">Volver</Link></Button>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2 rounded-none"><Link href={`/api/roleplay/warrants/${id}/pdf`}><Download className="size-4" /> Descargar PDF</Link></Button>
          <PrintButton label="Imprimir" />
        </div>
      </div>
      <WarrantDocument data={documentData} mode="print" />
      <p className="no-print mx-auto mt-4 max-w-[816px] text-xs text-slate-600">Para impresión limpia, desactive encabezados y pies del navegador o use “Descargar PDF”.</p>
    </div>
  );
}
