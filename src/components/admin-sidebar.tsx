"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, CalendarDays, ChevronDown, ClipboardList, FileSignature, FolderKanban, Gauge, History, LogOut, Megaphone, Scale, ScrollText, Search, Settings, ShieldAlert, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { logout } from "@/app/actions/auth";
import { InstitutionalMark } from "@/components/institutional-mark";
import { RealtimeStatus } from "@/components/realtime-status";

export const adminNav = [
  { label: "Panel general", href: "/admin/dashboard", icon: Gauge }, { label: "Expedientes", href: "/admin/expedientes", icon: FolderKanban },
  { label: "Actuaciones", href: "/admin/actuaciones", icon: Activity }, { label: "Providencias", href: "/admin/providencias", icon: FileSignature },
  { label: "Audiencias", href: "/admin/audiencias", icon: CalendarDays }, { label: "Warrants", href: "/admin/warrants", icon: ScrollText }, { label: "Estados judiciales", href: "/admin/estados", icon: ClipboardList },
  { label: "Comunicados", href: "/admin/comunicados", icon: Megaphone }, { label: "Dependencias", href: "/admin/dependencias", icon: Building2 },
  { label: "Usuarios", href: "/admin/usuarios", icon: Users }, { label: "Auditoría", href: "/admin/auditoria", icon: History },
  { label: "Configuración", href: "/admin/configuracion", icon: Settings },
];

function SidebarLinks() {
  const pathname = usePathname();
  return <nav className="mt-6 grid gap-1 px-3" aria-label="Panel interno">{adminNav.map(({ label, href, icon: Icon }) => { const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(`${href}/`)); return <Link key={href} href={href} className={cn("flex items-center gap-3 rounded px-3 py-2.5 text-[13px] transition", active ? "bg-white/10 font-semibold text-white shadow-[inset_3px_0_0_#c7a75e]" : "text-slate-300 hover:bg-white/5 hover:text-white")}><Icon className={cn("size-[17px]", active && "text-[#d2b56d]")} />{label}</Link>; })}</nav>;
}

export function AdminSidebar({ mobile = false }: { mobile?: boolean }) {
  const content = <><div className="flex h-24 items-center border-b border-white/10 px-5"><Link href="/admin/dashboard"><InstitutionalMark /></Link></div><SidebarLinks /><div className="mx-4 mt-4 rounded border border-amber-200/20 bg-amber-100/10 p-3 text-[11px] leading-5 text-amber-100"><ShieldAlert className="mb-2 size-4" /> Panel interno de roleplay. No emite actos reales.</div><div className="mt-auto border-t border-white/10 p-4"><form action={logout}><button type="submit" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"><LogOut className="size-4" /> Cerrar sesión</button></form></div></>;
  if (mobile) return <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir navegación"><Scale className="size-5" /></Button></SheetTrigger><SheetContent side="left" className="flex w-72 flex-col border-0 bg-[#102d49] p-0"><SheetTitle className="sr-only">Navegación interna</SheetTitle>{content}</SheetContent></Sheet>;
  return <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#102d49] lg:flex">{content}</aside>;
}

export function AdminTopbar() {
  return <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/95 px-4 backdrop-blur sm:px-6"><AdminSidebar mobile /><div className="relative hidden max-w-lg flex-1 md:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className="h-9 w-full rounded-md border bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-[#b38a3c]" placeholder="Buscar docket, persona, warrant o providencia…" aria-label="Búsqueda global" /></div><div className="ml-auto hidden md:block"><RealtimeStatus /></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-xs font-semibold text-[#153553]">Operador de roleplay</p><p className="text-[11px] text-muted-foreground">OWNER · Attorney General</p></div><button className="flex size-9 items-center justify-center rounded-full bg-[#173b5e] text-xs font-bold text-white">AG</button><ChevronDown className="size-4 text-slate-400" /></div></header>;
}
