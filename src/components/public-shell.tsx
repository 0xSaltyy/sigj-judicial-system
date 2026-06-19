import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { InstitutionalMark } from "@/components/institutional-mark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const links = [
  ["Inicio", "/"], ["Instituciones", "/instituciones"], ["Consulta de expedientes", "/consulta"], ["Comunicados", "/comunicados"],
  ["Audiencias", "/audiencias"], ["Estados judiciales", "/estados"], ["Providencias", "/providencias"],
];

export function InstitutionalHeader() {
  return <header className="no-print"><div className="bg-[#0e2943] text-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8"><Link href="/" aria-label="Inicio SIGJ"><InstitutionalMark /></Link><Link href="/login" className="text-xs font-semibold text-white hover:text-[#dcc68e]">Acceso institucional</Link></div></div><nav className="border-b bg-white shadow-[0_2px_12px_rgba(17,43,70,.05)]" aria-label="Navegación principal"><div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"><div className="hidden h-full items-center gap-7 lg:flex">{links.map(([label, href]) => <Link key={href} href={href} className="flex h-full items-center border-b-2 border-transparent text-[13px] font-medium text-slate-600 transition hover:border-[#b38a3c] hover:text-[#112b46]">{label}</Link>)}</div><Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-80 bg-[#102d49] p-6 text-white"><SheetTitle className="sr-only">Navegación</SheetTitle><InstitutionalMark /><div className="mt-8 grid gap-1">{links.map(([label, href]) => <Link key={href} href={href} className="rounded px-3 py-3 text-sm hover:bg-white/10">{label}</Link>)}</div><Button asChild className="mt-8 w-full bg-[#b38a3c] text-white hover:bg-[#9a752d]"><Link href="/login">Acceso institucional</Link></Button></SheetContent></Sheet><Link href="/consulta" className="ml-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#183d61]"><Search className="size-4" /> Consultar radicado</Link></div></nav></header>;
}

export function InstitutionalFooter() {
  return <footer className="no-print mt-auto bg-[#0b2238] text-slate-300"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.35fr_1fr_1fr] lg:px-8"><div><InstitutionalMark /><p className="mt-5 max-w-md text-sm leading-6 text-slate-400">Portal de servicios para la radicación, gestión y consulta de actuaciones judiciales.</p></div><div><h2 className="text-xs font-semibold uppercase tracking-[.18em] text-[#cdb374]">Servicios</h2><div className="mt-4 grid gap-2 text-sm"><Link href="/instituciones">Instituciones y competencias</Link><Link href="/consulta">Consulta de procesos</Link><Link href="/estados">Estados judiciales</Link><Link href="/audiencias">Agenda pública</Link><Link href="/providencias">Relatoría</Link></div></div><div><h2 className="text-xs font-semibold uppercase tracking-[.18em] text-[#cdb374]">Atención</h2><p className="mt-4 text-sm leading-6">Lunes a viernes · 8:00–17:00<br />Palacio Judicial<br />República de Colombia</p></div></div><div className="border-t border-white/10"><p className="mx-auto max-w-7xl px-4 py-4 text-center text-[11px] leading-5 text-slate-400 sm:px-6">Sistema ficticio de demostración académica. No corresponde a una autoridad judicial real ni produce efectos jurídicos.</p></div></footer>;
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col"><InstitutionalHeader /><main className="flex-1">{children}</main><InstitutionalFooter /></div>;
}
