import Link from "next/link";
import { Menu, Search, ShieldAlert } from "lucide-react";
import { InstitutionalMark } from "@/components/institutional-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ROLEPLAY_NOTICE } from "@/lib/demo-data";
import { RealtimeStatus } from "@/components/realtime-status";

const links = [
  ["Inicio", "/"],
  ["Acerca del Departamento", "/acerca"],
  ["Nuestro trabajo", "/nuestro-trabajo"],
  ["Comunicados", "/comunicados"],
  ["Postulaciones", "/postulaciones"],
  ["Providencias", "/providencias"],
  ["Expedientes públicos", "/expedientes-publicos"],
  ["Audiencias", "/audiencias"],
  ["Warrants", "/warrants"],
  ["Recursos", "/recursos"],
  ["Iniciar sesión", "/login"],
];

const footerColumns = [
  {
    title: "Servicios públicos",
    items: [
      ["Consultar expedientes", "/consulta"],
      ["Ver providencias", "/providencias"],
      ["Audiencias", "/audiencias"],
      ["Warrants públicos", "/warrants"],
    ],
  },
  {
    title: "Departamento",
    items: [
      ["Acerca del Departamento", "/acerca"],
      ["Nuestro trabajo", "/nuestro-trabajo"],
      ["Comunicados", "/comunicados"],
      ["Postulaciones", "/postulaciones"],
    ],
  },
  {
    title: "Recursos",
    items: [
      ["Centro de acciones", "/#centro-acciones"],
      ["Expedientes públicos", "/expedientes-publicos"],
      ["Recursos", "/recursos"],
      ["Acceso del personal", "/login"],
    ],
  },
];

export function InstitutionalHeader() {
  return (
    <header className="no-print">
      <div className="border-b border-amber-200 bg-amber-50 text-amber-950">
        <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-[11px] font-semibold leading-5 sm:px-6 lg:px-8">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>{ROLEPLAY_NOTICE}</span>
        </div>
      </div>
      <div className="bg-[#08233d] text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:px-8">
          <Link href="/" aria-label="Inicio Department of Justice Roleplay">
            <InstitutionalMark />
          </Link>
          <form className="relative order-3 lg:order-2" role="search">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Buscar comunicados, expedientes, audiencias o recursos…"
              className="h-11 border-white/15 bg-white pl-10 text-[#102d49] placeholder:text-slate-500"
              aria-label="Buscador global"
            />
          </form>
          <div className="order-2 flex items-center gap-3 lg:order-3">
            <div className="hidden xl:block"><RealtimeStatus /></div>
            <Button asChild className="bg-[#b38a3c] text-white hover:bg-[#9a752d]">
              <Link href="/login">Acceso del personal</Link>
            </Button>
          </div>
        </div>
      </div>
      <nav className="border-b bg-white shadow-[0_2px_12px_rgba(17,43,70,.06)]" aria-label="Navegación principal">
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="hidden h-full flex-wrap items-center gap-x-6 gap-y-1 lg:flex">
            {links.map(([label, href]) => (
              <Link key={href} href={href} className="nav-link flex h-14 items-center text-[13px] font-semibold text-slate-600 transition hover:text-[#102d49]">
                {label}
              </Link>
            ))}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 bg-[#08233d] p-6 text-white">
              <SheetTitle className="sr-only">Navegación</SheetTitle>
              <InstitutionalMark />
              <div className="mt-8 grid gap-1">
                {links.map(([label, href]) => (
                  <Link key={href} href={href} className="rounded px-3 py-3 text-sm transition hover:bg-white/10">
                    {label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/consulta" className="ml-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#183d61] lg:hidden">
            <Search className="size-4" /> Buscar
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function InstitutionalFooter() {
  return (
    <footer className="no-print mt-auto bg-[#061c32] text-slate-300">
      <div className="border-b border-white/10 bg-[#08233d]">
        <div className="mx-auto max-w-7xl px-4 py-4 text-center text-xs font-semibold leading-5 text-amber-100 sm:px-6 lg:px-8">
          {ROLEPLAY_NOTICE}
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.35fr_repeat(3,1fr)] lg:px-8">
        <div>
          <InstitutionalMark />
          <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">
            Portal funcional para una comunidad de roleplay jurídico. Ningún expediente, warrant, cargo,
            providencia o documento tiene validez jurídica real.
          </p>
          <p className="mt-4 text-sm font-semibold text-[#cdb374]">Developed by: kcobainn</p>
        </div>
        {footerColumns.map((column) => (
          <div key={column.title}>
            <h2 className="text-xs font-semibold uppercase tracking-[.18em] text-[#cdb374]">{column.title}</h2>
            <div className="mt-4 grid gap-2 text-sm">
              {column.items.map(([label, href]) => (
                <Link key={href} href={href} className="transition hover:text-white">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-center text-xs leading-5 text-slate-400 sm:px-6">
          ROLEPLAY DOCUMENTS ONLY — This website is fictional, is not affiliated with the real United States Department of Justice,
          and cannot issue real government or court orders. Developed by: kcobainn
        </p>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <InstitutionalHeader />
      <main className="flex-1">{children}</main>
      <InstitutionalFooter />
    </div>
  );
}
