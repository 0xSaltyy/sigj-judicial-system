import Link from "next/link";
import { Search } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { cases, formatDate } from "@/lib/demo-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Expedientes públicos" };

export default function PublicCasesPage() {
  const publicCases = cases.filter((item) => item.publicVisibility);
  return (
    <>
      <PageHero eyebrow="Expedientes públicos" title="Docket público roleplay" description="Listado de expedientes ficticios marcados como públicos. Los reservados no se exponen." />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-6 grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-[1fr_auto]">
          <Input placeholder="Buscar por número, título, estado o división…" />
          <Button variant="outline" className="gap-2"><Search className="size-4" /> Buscar</Button>
        </div>
        <div className="divide-y rounded-lg border bg-white">
          {publicCases.map((item) => (
            <article key={item.id} className="reveal p-6">
              <p className="mono-number text-xs font-semibold text-[#9a752f]">{item.internalNumber}</p>
              <h2 className="mt-2 font-serif text-xl font-semibold text-[#102d49]">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{item.court} · {item.status} · {formatDate(item.filedAt)}</span>
                <span className="flex flex-wrap gap-3">
                  <Link href="/consulta" className="font-semibold text-[#8b6829]">Consultar actuaciones</Link>
                  <Link href={`/api/roleplay/cases/${item.id}/pdf`} className="font-semibold text-[#153b5c]">Descargar PDF roleplay</Link>
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
