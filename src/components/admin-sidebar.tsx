"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FolderKanban,
  Gauge,
  History,
  LogOut,
  Megaphone,
  Menu,
  ScrollText,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { logout } from "@/app/actions/auth";
import { InstitutionalMark } from "@/components/institutional-mark";
import { RealtimeStatus } from "@/components/realtime-status";

export const adminNavGroups = [
  {
    title: "Operación federal",
    items: [
      { label: "Panel general", href: "/admin/dashboard", icon: Gauge },
      { label: "DOJ Matters", href: "/admin/matters", icon: BriefcaseBusiness },
      { label: "Federal Cases", href: "/admin/expedientes", icon: FolderKanban },
      { label: "Criminal History Records", href: "/admin/antecedentes", icon: ShieldCheck },
      { label: "Docket y eventos", href: "/admin/actuaciones", icon: Activity },
      { label: "Orders", href: "/admin/providencias", icon: FileSignature },
      { label: "Hearings", href: "/admin/audiencias", icon: CalendarDays },
      { label: "Warrants", href: "/admin/warrants", icon: ScrollText },
      { label: "Court notices", href: "/admin/estados", icon: ClipboardList },
      { label: "Utilities", href: "/admin/utilidades", icon: Wrench },
    ],
  },
  {
    title: "Atención pública",
    items: [
      { label: "Denuncias", href: "/admin/denuncias", icon: ShieldAlert },
      { label: "Postulaciones", href: "/admin/postulaciones", icon: ClipboardList },
      { label: "Comunicados", href: "/admin/comunicados", icon: Megaphone },
    ],
  },
  {
    title: "Administración",
    items: [
      { label: "Componentes DOJ", href: "/admin/dependencias", icon: Building2 },
      { label: "Usuarios", href: "/admin/usuarios", icon: Users },
      { label: "Auditoría", href: "/admin/auditoria", icon: History },
      { label: "Configuración", href: "/admin/configuracion", icon: Settings },
    ],
  },
];

export const adminNav = adminNavGroups.flatMap((group) => group.items);

function SidebarLinks() {
  const pathname = usePathname();
  return (
    <nav className="grid gap-5 px-3 py-5" aria-label="Panel interno">
      {adminNavGroups.map((group) => (
        <section key={group.title}>
          <h2 className="px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">{group.title}</h2>
          <div className="mt-2 grid gap-0.5">
            {group.items.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex min-h-9 items-center gap-2.5 border-l-2 px-3 py-2 text-[13px] transition",
                    active
                      ? "border-[#b21b1b] bg-white/10 font-semibold text-white"
                      : "border-transparent text-slate-300 hover:border-white/20 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className={cn("size-[16px]", active ? "text-white" : "text-slate-400")} />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

export function AdminSidebar({ mobile = false }: { mobile?: boolean }) {
  const content = (
    <>
      <div className="border-b border-white/10 p-4">
        <Link href="/admin/dashboard" className="block">
          <InstitutionalMark dark compact small />
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400">Internal Portal</p>
            <p className="mt-1 font-serif text-lg font-semibold text-white">Justice Operations</p>
          </div>
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarLinks />
      </div>
      <div className="border-t border-white/10 p-4">
        <form action={logout}>
          <button type="submit" className="flex min-h-9 items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white">
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </form>
      </div>
    </>
  );

  if (mobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="lg:hidden" aria-label="Abrir navegación">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-[86vw] max-w-80 flex-col border-0 bg-[#0a2540] p-0">
          <SheetTitle className="sr-only">Navegación interna</SheetTitle>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return <aside className="fixed inset-y-0 left-0 hidden w-[238px] flex-col bg-[#0a2540] lg:flex">{content}</aside>;
}

export function AdminTopbar() {
  return (
    <header className="sticky top-0 z-30 flex h-15 items-center gap-3 border-b border-[#cfd6dc] bg-[#fffdf8]/95 px-4 backdrop-blur sm:px-6">
      <AdminSidebar mobile />
      <div className="relative hidden max-w-xl flex-1 md:block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <input
          className="h-9 w-full border border-[#b7c2cd] bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#005ea8] focus:ring-3 focus:ring-[#005ea8]/15"
          placeholder="Buscar Matter, Case, persona, warrant u Order…"
          aria-label="Búsqueda global"
        />
      </div>
      <div className="ml-auto hidden items-center gap-3 md:flex">
        <RealtimeStatus />
        <Button variant="outline" size="icon" aria-label="Notificaciones">
          <Bell className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-3 border-l border-[#cfd6dc] pl-3">
        <div className="hidden text-right sm:block">
          <p className="text-xs font-semibold text-[#0a2540]">Pam Bondi</p>
          <p className="text-[11px] text-muted-foreground">Attorney General</p>
        </div>
        <button className="grid size-9 place-items-center border border-[#0a2540] bg-[#0a2540] text-xs font-bold text-white" aria-label="Menú de cuenta">
          PB
        </button>
      </div>
    </header>
  );
}
