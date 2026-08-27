import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";

export function AdminPageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-6 border-b border-[#cfd6dc] pb-5"><div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground"><Link href="/admin/dashboard" className="hover:text-[#005ea8]"><Home className="size-3.5" /></Link><ChevronRight className="size-3" /><span>{title}</span></div><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="font-serif text-2xl font-semibold tracking-tight text-[#0a2540] sm:text-[2rem]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#526273]">{description}</p></div>{action}</div></div>;
}

export function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <div className="formal-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#526273]">{label}</p><p className="mono-number mt-2 text-2xl font-semibold text-[#0a2540]">{value}</p></div><div className="grid size-9 place-items-center border border-[#cfd6dc] bg-[#f7f1e5] text-[#005ea8]">{icon}</div></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p></div>;
}

export function EmptyState({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return <div className="grid min-h-60 place-items-center border border-dashed border-[#9aa8b5] bg-[#fffdf8] p-8 text-center"><div><div className="mx-auto grid size-12 place-items-center border border-[#cfd6dc] bg-[#f7f1e5] text-[#526273]">{icon}</div><h3 className="mt-4 font-serif text-lg font-semibold text-[#0a2540]">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p></div></div>;
}
