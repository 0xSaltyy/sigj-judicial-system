import { CaseStatusBadge, ConfidentialityBadge } from "@/components/status-badges";

export function CaseHeaderCard({ caseNumber, docketNumber, status, confidentiality }: { caseNumber: string; docketNumber: string; status: string; confidentiality: string }) {
  return <div className="rounded-lg border-b-4 border-[#b38a3c] bg-[#102d49] p-6 text-white"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><p className="text-xs uppercase tracking-[.16em] text-[#d7bf83]">Federal Case</p><p className="mono-number mt-2 text-xl font-semibold">{caseNumber}</p><p className="mono-number mt-1 text-xs text-slate-300">{docketNumber || "No Docket Number"}</p></div><div className="flex items-start gap-2"><CaseStatusBadge status={status} /><ConfidentialityBadge level={confidentiality} /></div></div></div>;
}
