import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";

export function PageHero({ eyebrow = "Servicios judiciales", title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <div className="section-rule bg-[#fffdf8]">
      <div className="site-container py-10 lg:py-12">
        <div className="mb-7 flex items-center gap-2 text-xs text-slate-600"><Link href="/" aria-label="Inicio" className="text-[#005ea8] hover:underline"><Home className="size-3.5" /></Link><ChevronRight className="size-3" /><span>{title}</span></div>
        <p className="border-l-4 border-[#8f1d1d] pl-3 text-xs font-semibold uppercase tracking-[.18em] text-[#526273]">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl font-serif text-4xl font-semibold tracking-tight text-[#0a2540] sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-700">{description}</p>
      </div>
    </div>
  );
}
