import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";

export function AdminPageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7"><div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground"><Link href="/admin/dashboard"><Home className="size-3.5" /></Link><ChevronRight className="size-3" /><span>{title}</span></div><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-semibold tracking-tight text-[#102d49] sm:text-3xl">{title}</h1><p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p></div>{action}</div></div>;
}

export function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <div className="rounded-lg border bg-white p-5 shadow-[0_2px_12px_rgba(17,43,70,.04)]"><div className="flex items-start justify-between"><div><p className="text-xs font-medium uppercase tracking-[.08em] text-muted-foreground">{label}</p><p className="mono-number mt-2 text-3xl font-semibold text-[#143654]">{value}</p></div><div className="grid size-10 place-items-center rounded bg-[#edf2f6] text-[#234e73]">{icon}</div></div><p className="mt-3 text-xs text-muted-foreground">{detail}</p></div>;
}

export function EmptyState({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return <div className="grid min-h-64 place-items-center rounded-lg border border-dashed bg-white p-8 text-center"><div><div className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">{icon}</div><h3 className="mt-4 text-sm font-semibold text-[#153553]">{title}</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p></div></div>;
}
