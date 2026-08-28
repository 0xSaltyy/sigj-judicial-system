import { Badge } from "@/components/ui/badge";
import { LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

const colors: Record<string, string> = {
  "Intake": "bg-sky-50 text-sky-800 border-sky-200",
  "Case opened by Clerk": "bg-indigo-50 text-indigo-800 border-indigo-200",
  "Awaiting Clerk docketing": "bg-amber-50 text-amber-800 border-amber-200",
  "Notice filed": "bg-violet-50 text-violet-800 border-violet-200",
  "Docketed": "bg-indigo-50 text-indigo-800 border-indigo-200",
  "Discovery": "bg-orange-50 text-orange-800 border-orange-200",
  "Judgment": "bg-emerald-50 text-emerald-800 border-emerald-200",
  "Closed": "bg-slate-100 text-slate-700 border-slate-200",
  "Published": "bg-emerald-50 text-emerald-800 border-emerald-200",
  "Signed": "bg-emerald-50 text-emerald-800 border-emerald-200",
  "Scheduled": "bg-blue-50 text-blue-800 border-blue-200",
  "Completed": "bg-slate-100 text-slate-700 border-slate-200",
  "Archived": "bg-slate-100 text-slate-700 border-slate-200",
  "Draft": "bg-amber-50 text-amber-800 border-amber-200",
};

const labels: Record<string, string> = {};

export function CaseStatusBadge({ status }: { status: string }) { return <Badge variant="outline" className={cn("whitespace-nowrap font-medium", colors[status] ?? "bg-slate-50 text-slate-700")}>{labels[status] ?? status}</Badge>; }
export function ConfidentialityBadge({ level }: { level: string }) {
  const publicLevel = level === "Público" || level === "Public";
  const restricted = level === "Restricted" || level === "Reservado";
  return <Badge variant="outline" className={cn("gap-1", publicLevel ? "border-emerald-200 bg-emerald-50 text-emerald-800" : restricted ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800")}><LockKeyhole className="size-3" />{level}</Badge>;
}
