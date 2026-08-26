import { Download } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { warrants, formatDate } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Warrants" };

export default function WarrantsPage() {
  return (
    <>
      <PageHero
        eyebrow="Warrants"
        title="Órdenes y warrants públicos"
        description="Consulta limitada de órdenes publicadas por las unidades autorizadas."
      />
      <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-4">
          {warrants.map((item) => (
            <article key={item.id} className="reveal border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="mono-number text-xs font-semibold text-[#9a752f]">{item.number}</p>
                  <h2 className="mt-2 font-serif text-xl font-semibold text-[#102d49]">{item.type}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{item.target} · {item.caseNumber}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Expira: {formatDate(item.expires)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{item.status}</Badge>
                  <Badge className={item.public ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}>{item.public ? "Público" : "Reservado"}</Badge>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-slate-600">Documento disponible para consulta pública.</p>
                <Button variant="outline" size="sm" className="gap-2 rounded-none"><Download className="size-4" /> Descargar PDF</Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
