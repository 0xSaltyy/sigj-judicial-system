import { AlertCircle, CheckCircle2 } from "lucide-react";

export function ActionMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  const Icon=error?AlertCircle:CheckCircle2;
  return <p role={error?"alert":"status"} data-no-print="true" className={`alert notice-enter mb-5 flex items-start gap-3 rounded border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "success-pulse border-emerald-200 bg-emerald-50 text-emerald-800"}`}><Icon className="mt-0.5 size-4 shrink-0"/><span className="min-w-0 break-words">{error ?? success}</span></p>;
}
