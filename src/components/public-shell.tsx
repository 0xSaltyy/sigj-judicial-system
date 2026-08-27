import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { InstitutionalMark } from "@/components/institutional-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ROLEPLAY_NOTICE } from "@/lib/demo-data";

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
  ["Denuncias", "/denuncias/nueva"],
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
      ["Realizar denuncia", "/denuncias/nueva"],
      ["Consultar denuncia", "/denuncias/estado"],
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
      ["Estado de denuncia", "/denuncias/estado"],
      ["Recursos", "/recursos"],
      ["Acceso del personal", "/login"],
    ],
  },
];

export function InstitutionalHeader() {
  return (
    <header className="no-print">
      <div className="bg-white">
        <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[auto_1fr] lg:items-center lg:px-8">
          <Link href="/" aria-label="Inicio U.S. Department of Justice">
            <InstitutionalMark />
          </Link>
          <form className="relative lg:ml-auto lg:w-[420px]" role="search">
            <label htmlFor="site-search" className="mb-2 block text-[11px] font-semibold uppercase tracking-[.14em] text-slate-600">Search</label>
            <Input
              id="site-search"
              type="search"
              placeholder="Buscar"
              className="h-11 rounded-none border-slate-500 bg-white pr-12 text-[#102d49] placeholder:text-slate-500"
              aria-label="Buscador global"
            />
            <Button type="submit" className="absolute bottom-0 right-0 h-11 rounded-none bg-[#005ea8] px-4 hover:bg-[#1a4480]" aria-label="Buscar">
              <Search className="size-4" />
            </Button>
          </form>
        </div>
      </div>
      <nav className="bg-[#112f4e] text-white" aria-label="Navegación principal">
        <div className="mx-auto flex min-h-14 max-w-[1180px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="hidden h-full flex-wrap items-center lg:flex">
            {links.map(([label, href]) => (
              <Link key={href} href={href} className="nav-link flex h-14 items-center border-l border-white/10 px-3 text-[13px] font-semibold text-white transition hover:bg-[#1a4480] xl:px-4">
                {label}
              </Link>
            ))}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white lg:hidden" aria-label="Abrir menú">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 bg-[#112f4e] p-6 text-white">
              <SheetTitle className="sr-only">Navegación</SheetTitle>
              <InstitutionalMark dark />
              <div className="mt-8 grid gap-1">
                {links.map(([label, href]) => (
                  <Link key={href} href={href} className="rounded px-3 py-3 text-sm transition hover:bg-white/10">
                    {label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/consulta" className="ml-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white lg:hidden">
            <Search className="size-4" /> Buscar
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function InstitutionalFooter() {
  return (
    <footer className="no-print mt-auto bg-[#112f4e] text-slate-200">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_repeat(3,1fr)] lg:px-8">
        <div>
          <InstitutionalMark dark />
          <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">
            Portal institucional para consulta pública, comunicados, expedientes, audiencias y servicios del Departamento.
          </p>
        </div>
        {footerColumns.map((column) => (
          <div key={column.title}>
            <h2 className="border-b border-white/20 pb-3 text-xs font-semibold uppercase tracking-[.18em] text-white">{column.title}</h2>
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
        <div className="mx-auto max-w-[1180px] px-4 py-5 text-center text-xs leading-5 text-slate-400 sm:px-6">
          <p>{ROLEPLAY_NOTICE}</p>
          <p className="mt-1">Developed by: kcobainn</p>
        </div>
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
