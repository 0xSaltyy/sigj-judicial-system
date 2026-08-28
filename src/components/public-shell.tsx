import Link from "next/link";
import { ChevronDown, Menu, Search } from "lucide-react";
import { InstitutionalMark } from "@/components/institutional-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ROLEPLAY_NOTICE } from "@/lib/identity";

const navGroups = [
  { label: "Inicio", href: "/" },
  {
    label: "Departamento",
    href: "/acerca",
    items: [
      ["Acerca del Departamento", "/acerca"],
      ["Nuestro trabajo", "/nuestro-trabajo"],
      ["Recursos", "/recursos"],
    ],
  },
  {
    label: "Actualidad",
    href: "/comunicados",
    items: [
      ["Comunicados", "/comunicados"],
      ["Convocatorias", "/convocatorias"],
      ["Postulaciones", "/postulaciones"],
      ["Estado de postulación", "/convocatorias/estado"],
    ],
  },
  {
    label: "Servicios públicos",
    href: "/consulta",
    items: [
      ["Consultar Federal Cases", "/consulta"],
      ["Orders", "/providencias"],
      ["Cases públicos", "/expedientes-publicos"],
      ["Audiencias", "/audiencias"],
      ["Warrants", "/warrants"],
      ["Denuncias", "/denuncias/nueva"],
    ],
  },
  { label: "Iniciar sesión", href: "/login" },
];

const footerColumns = [
  {
    title: "Servicios públicos",
    items: [
      ["Consultar Federal Cases", "/consulta"],
      ["Ver Orders", "/providencias"],
      ["Audiencias públicas", "/audiencias"],
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
      ["Convocatorias", "/convocatorias"],
      ["Postulaciones", "/postulaciones"],
    ],
  },
  {
    title: "Recursos",
    items: [
      ["Centro de acciones", "/#centro-acciones"],
      ["Cases públicos", "/expedientes-publicos"],
      ["Estado de postulación", "/convocatorias/estado"],
      ["Recursos", "/recursos"],
      ["Acceso del personal", "/login"],
    ],
  },
];

export function InstitutionalHeader() {
  return (
    <header className="no-print border-b border-[#b7c2cd] bg-[#fffdf8]">
      <div className="border-b border-[#e0d8ca] bg-[#f7f1e5]">
        <div className="site-container flex items-center justify-between gap-4 py-2 text-[11px] uppercase tracking-[.14em] text-[#526273]">
          <span>United States</span>
          <Link href="/login" className="hidden font-semibold text-[#0a2540] underline-offset-4 hover:underline sm:inline">
            Staff access
          </Link>
        </div>
      </div>
      <div className="site-container grid gap-6 py-5 lg:grid-cols-[auto_1fr] lg:items-center">
        <Link href="/" aria-label="Inicio U.S. Department of Justice" className="min-w-0">
          <InstitutionalMark />
        </Link>
        <div className="grid gap-3 lg:justify-items-end">
          <form className="relative w-full lg:w-[430px]" role="search">
            <label htmlFor="site-search" className="sr-only">Buscar en el sitio</label>
            <Input
              id="site-search"
              type="search"
              placeholder="Search DOJ roleplay records"
              className="h-11 rounded-none border-[#7b8fa2] bg-white pr-12 text-[#102d49] placeholder:text-slate-500"
              aria-label="Buscador global"
            />
            <Button type="submit" className="absolute right-0 top-0 h-11 rounded-none bg-[#005ea8] px-4 hover:bg-[#0a2540]" aria-label="Buscar">
              <Search className="size-4" />
            </Button>
          </form>
          <p className="hidden text-xs text-[#526273] lg:block">Public access, records, notices, hearings and personnel services</p>
        </div>
      </div>
      <nav className="bg-[#0a2540] text-white" aria-label="Navegación principal">
        <div className="site-container flex min-h-12 items-center">
          <div className="hidden h-full items-center lg:flex">
            {navGroups.map((item) => (
              <div key={item.label} className="group relative">
                <Link href={item.href} className="nav-link flex h-12 items-center gap-1 border-l border-white/10 px-4 text-[13px] font-semibold text-white transition hover:bg-[#14385a]">
                  {item.label}
                  {item.items ? <ChevronDown className="size-3.5 text-white/70" /> : null}
                </Link>
                {item.items ? (
                  <div className="invisible absolute left-0 top-full z-40 min-w-64 border border-[#b7c2cd] bg-[#fffdf8] py-2 text-[#0a2540] opacity-0 shadow-[0_12px_30px_rgba(10,37,64,.18)] transition group-hover:visible group-hover:opacity-100">
                    {item.items.map(([label, href]) => (
                      <Link key={href} href={href} className="block px-4 py-2.5 text-sm hover:bg-[#f7f1e5]">
                        {label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="my-2 text-white hover:bg-white/10 hover:text-white lg:hidden" aria-label="Abrir menú">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[86vw] max-w-sm border-r-0 bg-[#0a2540] p-0 text-white">
              <SheetTitle className="sr-only">Navegación</SheetTitle>
              <div className="border-b border-white/10 p-5">
                <InstitutionalMark dark small />
              </div>
              <div className="grid p-3">
                {navGroups.map((item) => (
                  <div key={item.label} className="border-b border-white/10 py-2 last:border-0">
                    <Link href={item.href} className="block px-3 py-2 text-sm font-semibold hover:bg-white/10">
                      {item.label}
                    </Link>
                    {item.items ? (
                      <div className="ml-3 grid border-l border-white/10 pl-3">
                        {item.items.map(([label, href]) => (
                          <Link key={href} href={href} className="px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
                            {label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
    <footer className="no-print mt-auto bg-[#0a2540] text-slate-200">
      <div className="site-container grid gap-10 py-12 md:grid-cols-[1.15fr_repeat(3,1fr)]">
        <div>
          <InstitutionalMark dark />
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
            Portal público para consulta de Federal Cases, comunicaciones, audiencias, denuncias y servicios del personal autorizado.
          </p>
        </div>
        {footerColumns.map((column) => (
          <div key={column.title}>
            <h2 className="border-b border-white/20 pb-3 text-xs font-semibold uppercase tracking-[.18em] text-white">{column.title}</h2>
            <div className="mt-4 grid gap-2 text-sm">
              {column.items.map(([label, href]) => (
                <Link key={href} href={href} className="text-slate-300 transition hover:text-white">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 bg-[#06192b]">
        <div className="site-container px-0 py-5 text-center text-xs leading-5 text-slate-400">
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
