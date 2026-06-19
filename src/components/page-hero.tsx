import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";

export function PageHero({ eyebrow = "Servicios judiciales", title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <div className="border-b bg-[#102d49] text-white institutional-grid">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-6 flex items-center gap-2 text-xs text-slate-300"><Link href="/" aria-label="Inicio"><Home className="size-3.5" /></Link><ChevronRight className="size-3" /><span>{title}</span></div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#d1b56f]">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{description}</p>
      </div>
    </div>
  );
}
