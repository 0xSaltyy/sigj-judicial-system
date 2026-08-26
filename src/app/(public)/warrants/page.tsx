import { Download, ShieldAlert } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { warrants, formatDate } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Warrants" };

export default function WarrantsPage() {
  return (
    <>
      <PageHero
        eyebrow="Warrants roleplay"
        title="Órdenes ficticias y warrants públicos"
        description="Consulta limitada de órdenes narrativas marcadas claramente como documentos de roleplay."
      />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <strong>ROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.</strong> No use estos documentos fuera del entorno ficticio.
        </div>
        <div className="grid gap-4">
          {warrants.map((item) => (
            <article key={item.id} className="reveal rounded-xl border bg-white p-6">
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
                <p className="flex items-center gap-2 text-xs text-amber-900"><ShieldAlert className="size-4" /> Descarga siempre marcada como roleplay.</p>
                <Button variant="outline" size="sm" className="gap-2"><Download className="size-4" /> Descargar PDF ficticio</Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
