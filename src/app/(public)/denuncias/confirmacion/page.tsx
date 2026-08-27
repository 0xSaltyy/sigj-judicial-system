import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Denuncia recibida" };

export default async function ComplaintConfirmationPage({ searchParams }: { searchParams: Promise<{ tracking?: string; code?: string }> }) {
  const query = await searchParams;
  return (
    <div className="bg-[#f5f7f9]">
      <div className="mx-auto max-w-[760px] px-4 py-16 sm:px-6 lg:px-8">
        <section className="border bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto size-12 text-emerald-700" />
          <h1 className="mt-5 font-serif text-3xl font-semibold text-[#112f4e]">Denuncia recibida correctamente</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-700">Guarde este número y código privado. Los necesitará para consultar el estado de su denuncia.</p>
          <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
            <CodeBlock label="Número de denuncia" value={query.tracking || "No disponible"} />
            <CodeBlock label="Código privado" value={query.code || "No disponible"} />
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-none bg-[#005ea8] hover:bg-[#1a4480]"><Link href={`/denuncias/estado?tracking=${encodeURIComponent(query.tracking || "")}&code=${encodeURIComponent(query.code || "")}`}>Consultar estado</Link></Button>
            <Button asChild variant="outline" className="rounded-none"><Link href="/">Volver al inicio</Link></Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  return <div className="border bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">{label}</p><p className="mono-number mt-2 break-all text-lg font-semibold text-[#112f4e]">{value}</p></div>;
}
