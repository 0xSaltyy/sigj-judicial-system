import { actions, formatDate } from "@/lib/demo-data";
import { Check } from "lucide-react";

export function CaseTimeline({ caseId }: { caseId: string }) {
  const items = actions.filter((item) => item.caseId === caseId);
  return <div className="space-y-0">{items.length ? items.map((item, index) => <div key={item.id} className="relative grid grid-cols-[30px_1fr] gap-3 pb-7"><div className="relative"><span className="grid size-7 place-items-center rounded-full bg-[#173b5e] text-white"><Check className="size-3.5" /></span>{index < items.length - 1 && <span className="absolute left-3.5 top-7 h-full w-px bg-border" />}</div><div><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-[#153553]">{item.title}</h3><time className="mono-number text-xs text-muted-foreground">{formatDate(item.date)}</time></div><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p><p className="mt-2 text-xs text-slate-500">{item.user} · {item.visibility}</p></div></div>) : <p className="text-sm text-muted-foreground">No hay actuaciones registradas.</p>}</div>;
}
