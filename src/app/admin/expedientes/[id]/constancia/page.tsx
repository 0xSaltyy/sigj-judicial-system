import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

type CaseCertificateRow = {
  case_number: string | null;
  docket_number: string | null;
  internal_number: string;
  filed_at: string;
  case_caption: string | null;
  case_category: string;
  summary: string;
  federal_access_level: string;
  filing_status: string | null;
  federal_courts: { official_name: string; abbreviation: string } | { official_name: string; abbreviation: string }[] | null;
};

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: item } = await supabase
    .from("cases")
    .select("case_number,docket_number,internal_number,filed_at,case_caption,case_category,summary,federal_access_level,filing_status,federal_courts(official_name,abbreviation)")
    .eq("id", id)
    .maybeSingle();
  if (!item) notFound();
  const caseItem = item as CaseCertificateRow;
  const court = Array.isArray(caseItem.federal_courts) ? caseItem.federal_courts[0] : caseItem.federal_courts;
  const displayCaseNumber = caseItem.case_number || caseItem.internal_number;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex justify-end"><PrintButton label="Print opening certificate" /></div>
      <article className="paper min-h-[850px] border p-10 sm:p-16">
        <header className="flex items-center gap-4 border-b-2 border-[#153553] pb-7">
          <div className="grid size-14 place-items-center rounded border-2 border-[#b38a3c] text-[#153553]"><Scale className="size-7" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#98712b]">U.S. Department of Justice</p>
            <h1 className="mt-1 text-xl font-bold text-[#102d49]">Federal Case Opening Certificate</h1>
            <p className="text-xs text-muted-foreground">Internal records and court docket identifiers are maintained separately.</p>
          </div>
        </header>
        <div className="my-10 rounded border-2 border-[#153553] p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Case Number assigned by portal</p>
          <p className="mono-number mt-3 text-2xl font-bold text-[#102d49]">{displayCaseNumber}</p>
          <p className="mono-number mt-2 text-sm text-muted-foreground">{caseItem.docket_number || "No Docket Number assigned by Clerk’s Office."}</p>
        </div>
        <dl className="grid gap-y-5 text-sm sm:grid-cols-[190px_1fr]">
          <dt className="font-semibold text-slate-500">Opened</dt><dd>{formatDate(caseItem.filed_at)}</dd>
          <dt className="font-semibold text-slate-500">Federal court</dt><dd>{court?.official_name || "Court pending"}</dd>
          <dt className="font-semibold text-slate-500">Case Category</dt><dd>{caseItem.case_category}</dd>
          <dt className="font-semibold text-slate-500">Caption</dt><dd>{caseItem.case_caption || "Caption pending"}</dd>
          <dt className="font-semibold text-slate-500">Filing status</dt><dd>{caseItem.filing_status || "Awaiting Clerk docketing"}</dd>
          <dt className="font-semibold text-slate-500">Access level</dt><dd>{caseItem.federal_access_level}</dd>
          <dt className="font-semibold text-slate-500">Summary</dt><dd>{caseItem.summary}</dd>
        </dl>
        <div className="mt-12 flex items-end justify-between border-t pt-8">
          <div className="max-w-sm text-xs leading-5 text-muted-foreground">Certificate generated from the internal DOJ roleplay portal. This certificate does not create a court docket.</div>
          <div className="grid size-24 grid-cols-5 gap-1 bg-[#102d49] p-2" aria-label="Visual verification code">{Array.from({ length: 25 }).map((_, i) => <span key={i} className={(i * 7 + 3) % 5 < 2 ? "bg-white" : "bg-[#102d49]"} />)}</div>
        </div>
      </article>
    </div>
  );
}
