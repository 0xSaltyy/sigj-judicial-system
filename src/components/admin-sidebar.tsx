"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  Bell,
  CalendarDays,
  ChevronDown,
  FileSignature,
  FolderKanban,
  Gauge,
  History,
  LogOut,
  Megaphone,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logout } from "@/app/actions/auth";

export const adminNav = [
  { label: "Panel general", href: "/admin/dashboard", icon: Gauge },
  { label: "Expedientes", href: "/admin/expedientes", icon: FolderKanban },
  { label: "Actuaciones", href: "/admin/actuaciones", icon: Activity },
  { label: "Providencias", href: "/admin/providencias", icon: FileSignature },
  { label: "Audiencias", href: "/admin/audiencias", icon: CalendarDays },
  { label: "Comunicados", href: "/admin/comunicados", icon: Megaphone },
  { label: "Notificaciones", href: "/admin/notificaciones", icon: Bell },
  { label: "Instituciones", href: "/admin/dependencias", icon: Building2 },
  { label: "Usuarios", href: "/admin/usuarios", icon: Users, permission: "users" },
  {
    label: "Roles y permisos",
    href: "/admin/roles",
    icon: ShieldCheck,
    permission: "roles",
  },
  {
    label: "Auditoría",
    href: "/admin/auditoria",
    icon: History,
    permission: "audit",
  },
  { label: "Configuración", href: "/admin/configuracion", icon: Settings },
];

type Viewer = {
  fullName: string;
  role: string;
  institution: string;
  isOwner: boolean;
  unreadNotifications?: number;
  latestNotifications?: Array<{ id: string; title: string; message: string; link_url: string | null; read_at: string | null }>;
  avatarUrl?: string | null;
  permissions?: { users: boolean; roles: boolean; audit: boolean };
};

function SidebarLinks({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  return (
    <nav className="mt-6 grid gap-1 px-3" aria-label="Panel interno">
      {adminNav
        .filter((item) => !item.permission || viewer.isOwner || viewer.permissions?.[item.permission as keyof NonNullable<Viewer["permissions"]>])
        .map(({ label, href, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/admin/dashboard" && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded px-3 py-2.5 text-[13px] transition",
                active
                  ? "bg-white/10 font-semibold text-white shadow-[inset_3px_0_0_#c7a75e]"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className={cn("size-[17px]", active && "text-[#d2b56d]")} />
              {label}
            </Link>
          );
        })}
    </nav>
  );
}

export function AdminSidebar({
  mobile = false,
  viewer,
}: {
  mobile?: boolean;
  viewer: Viewer;
}) {
  const content = (
    <>
      <div className="flex h-20 items-center border-b border-white/10 px-5">
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <div className="relative size-11 overflow-hidden rounded-md border border-white/20 bg-white p-1 shadow-sm">
            <Image
              src="/escudo-institucional.png"
              alt="Escudo institucional de Colombia"
              fill
              sizes="44px"
              className="object-contain p-1"
              priority
            />
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[.2em] text-[#cdb374]">
              SIGJ
            </p>
            <p className="text-sm font-semibold text-white">Palacio Judicial</p>
          </div>
        </Link>
      </div>
      <SidebarLinks viewer={viewer} />
      <div className="mt-auto border-t border-white/10 p-4">
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"
          >
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </form>
      </div>
    </>
  );
  if (mobile)
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative overflow-hidden rounded-md bg-white p-1 lg:hidden"
            aria-label="Abrir navegación"
          >
            <Image
              src="/escudo-institucional.png"
              alt="Abrir navegación del SIGJ"
              fill
              sizes="32px"
              className="object-contain p-1"
            />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex w-72 flex-col border-0 bg-[#102d49] p-0"
        >
          <SheetTitle className="sr-only">Navegación interna</SheetTitle>
          {content}
        </SheetContent>
      </Sheet>
    );
  return (
    <aside data-app-sidebar className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#102d49] lg:flex">
      {content}
    </aside>
  );
}

export function AdminTopbar({ viewer }: { viewer: Viewer }) {
  const initials = viewer.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <header data-app-header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/95 px-4 backdrop-blur sm:px-6">
      <AdminSidebar mobile viewer={viewer} />
      <form
        action="/admin/expedientes"
        method="get"
        role="search"
        className="relative hidden max-w-lg flex-1 md:block"
      >
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          name="q"
          className="h-9 w-full rounded-md border bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-[#b38a3c]"
          placeholder="Buscar radicado, parte o título…"
          aria-label="Búsqueda global"
        />
      </form>
      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="relative" aria-label="Notificaciones internas"><Bell className="size-5" />{Boolean(viewer.unreadNotifications) && <span className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-red-700 px-1 text-[9px] font-bold text-white">{Math.min(viewer.unreadNotifications ?? 0,99)}</span>}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-80"><DropdownMenuLabel>Notificaciones internas</DropdownMenuLabel><DropdownMenuSeparator />{(viewer.latestNotifications ?? []).map((item) => <DropdownMenuItem key={item.id} asChild><Link href={item.link_url ?? "/admin/notificaciones"} className={`block cursor-pointer p-2 ${item.read_at ? "opacity-70" : "font-semibold"}`}><span className="block text-xs">{item.title}</span><span className="mt-1 line-clamp-2 text-[11px] font-normal text-muted-foreground">{item.message}</span></Link></DropdownMenuItem>)}{!viewer.latestNotifications?.length && <DropdownMenuItem disabled>Sin notificaciones</DropdownMenuItem>}<DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/admin/notificaciones" className="cursor-pointer justify-center font-semibold">Ver todas</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        <div className="hidden text-right sm:block">
          <p className="text-xs font-semibold text-[#153553]">
            {viewer.fullName}
          </p>
          <p className="max-w-72 truncate text-[11px] text-muted-foreground">
            {viewer.role} · {viewer.institution}
          </p>
        </div>
        <Link href="/admin/perfil" aria-label="Abrir mi perfil" className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-[#173b5e] text-xs font-bold text-white">
          {viewer.avatarUrl ? <Image src={viewer.avatarUrl} alt="" width={36} height={36} unoptimized className="size-full object-cover" /> : initials}
        </Link>
        <ChevronDown className="size-4 text-slate-400" />
      </div>
    </header>
  );
}
