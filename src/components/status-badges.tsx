import { Badge } from "@/components/ui/badge";
import { LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

const colors: Record<string, string> = {
  Radicado: "bg-sky-50 text-sky-800 border-sky-200",
  "En reparto": "bg-violet-50 text-violet-800 border-violet-200",
  Admitido: "bg-indigo-50 text-indigo-800 border-indigo-200",
  "En instrucción": "bg-amber-50 text-amber-800 border-amber-200",
  "Pruebas decretadas": "bg-orange-50 text-orange-800 border-orange-200",
  "Auto de avocamiento": "bg-blue-50 text-blue-800 border-blue-200",
  "Audiencia programada": "bg-amber-50 text-amber-800 border-amber-200",
  "En decisión": "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
  Sentenciado: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Publicado: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Programada: "bg-blue-50 text-blue-800 border-blue-200",
  Realizada: "bg-slate-100 text-slate-700 border-slate-200",
  Archivado: "bg-slate-100 text-slate-700 border-slate-200",
  Borrador: "bg-amber-50 text-amber-800 border-amber-200",
};

export function CaseStatusBadge({ status }: { status?: string | null }) {
  const visibleStatus = status || "Sin estado";
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap font-medium",
        colors[visibleStatus] ?? "bg-slate-50 text-slate-700",
      )}
    >
      {visibleStatus}
    </Badge>
  );
}
export function ConfidentialityBadge({ level }: { level?: string | null }) {
  const visibleLevel = level || "No registrado";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1",
          visibleLevel === "Público"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      )}
    >
      <LockKeyhole className="size-3" />
      {visibleLevel}
    </Badge>
  );
}
