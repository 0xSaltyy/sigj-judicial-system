import Link from "next/link";
import { FileSearch, Search } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

export const metadata = { title: "Expedientes públicos" };

export default async function PublicCasesPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("cases").select("id,internal_number,title,summary,status,chamber,filed_at").eq("public_visibility", true).eq("confidentiality_level", "Público").is("archived_at", null).order("filed_at", { ascending: false }).limit(50) : { data: null };
  const publicCases = data ?? [];
  return (
    <>
      <PageHero eyebrow="Expedientes públicos" title="Docket público" description="Listado de expedientes marcados como públicos. Los reservados no se exponen." />
      <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-6 grid gap-3 border bg-white p-4 sm:grid-cols-[1fr_auto]">
          <Input placeholder="Buscar por número, título, estado o división…" />
          <Button variant="outline" className="gap-2 rounded-none"><Search className="size-4" /> Buscar</Button>
        </div>
        <div className="divide-y border bg-white">
          {publicCases.length === 0 ? <Empty text="No hay expedientes públicos disponibles." /> : publicCases.map((item) => (
            <article key={item.id} className="reveal p-6">
              <p className="mono-number text-xs font-semibold text-[#9a752f]">{item.internal_number}</p>
              <h2 className="mt-2 font-serif text-xl font-semibold text-[#102d49]">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{item.chamber} · {item.status} · {formatDate(item.filed_at)}</span>
                <span className="flex flex-wrap gap-3">
                  <Link href="/consulta" className="font-semibold text-[#8b6829]">Consultar actuaciones</Link>
                  <Link href={`/api/roleplay/cases/${item.id}/pdf`} className="font-semibold text-[#153b5c]">Descargar PDF</Link>
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

function Empty({ text }: { text: string }) { return <div className="grid min-h-56 place-items-center p-8 text-center"><div><FileSearch className="mx-auto size-8 text-slate-400" /><p className="mt-3 text-sm text-slate-600">{text}</p></div></div>; }
