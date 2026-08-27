import { buildWarrantSections, getWarrantTemplate, getWarrantTitle, normalizeWarrantData, ROLEPLAY_DOCUMENT_NOTICE, ROLEPLAY_WATERMARK, type WarrantFormData } from "@/lib/warrants";

export function WarrantDocument({ data, mode = "preview" }: { data: Partial<WarrantFormData> & Record<string, unknown>; mode?: "preview" | "print" }) {
  const record = normalizeWarrantData(data);
  const template = getWarrantTemplate(record.warrant_type);
  const sections = buildWarrantSections(record);
  const issueDate = formatDateTime(record.issued_at);
  const expiresAt = formatDateTime(record.expires_at);

  return (
    <article className={`warrant-document ${mode === "preview" ? "mx-auto max-w-[816px] border bg-white shadow-sm" : "bg-white"} relative min-h-[1056px] overflow-hidden p-[54px] text-black`}>
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 text-center font-serif text-5xl font-bold uppercase tracking-widest text-slate-200/70">
        {ROLEPLAY_WATERMARK}
      </div>
      <div className="relative z-10">
        <header>
          <div className="flex items-start justify-between text-[10px]">
            <p className="font-serif font-bold">RP-AO93 — {template.label}</p>
            <p className="text-right">Prepared for roleplay court administration</p>
          </div>
          <div className="mt-2 border-y-2 border-black py-4 text-center font-serif">
            <p className="text-sm font-bold uppercase tracking-wide">UNITED STATES DISTRICT COURT</p>
            <p className="mt-1 text-sm uppercase">{record.district}</p>
            {record.division ? <p className="mt-1 text-xs uppercase">{record.division}</p> : null}
          </div>
        </header>

        <section className="mt-6 grid grid-cols-[1fr_190px] gap-6 text-sm">
          <div>
            <p className="font-serif italic">{template.subjectLabel}</p>
            <div className="mt-2 min-h-24 border-b border-black whitespace-pre-line pb-2 leading-6">
              {record.target_description || record.person_name || record.precise_location || record.account_identifier || " "}
            </div>
          </div>
          <div>
            <p className="font-serif">Case No.</p>
            <div className="mt-2 border-b border-black pb-2 font-mono text-xs">{record.case_number || record.warrant_number || "Pending"}</div>
          </div>
        </section>

        <h1 className="mt-8 text-center font-serif text-lg font-bold uppercase tracking-wide">{getWarrantTitle(record)}</h1>

        <section className="mt-6 space-y-4 text-sm leading-6">
          <p><span className="font-serif font-bold">To:</span> Any authorized law enforcement officer</p>
          <p>
            An application by <LineValue value={record.applicant_name} /> {record.applicant_title ? `, ${record.applicant_title}` : ""}{record.applicant_agency ? `, ${record.applicant_agency}` : ""}, and the supporting statement or affidavit having been presented, the Court issues this warrant.
          </p>
          <p>{template.orderText}</p>
        </section>

        <section className="mt-6 space-y-4 text-sm">
          {sections.slice(0, 4).map((section) => (
            <div key={section.title} className="avoid-break">
              <h2 className="border-b border-black pb-1 font-serif text-sm font-bold uppercase">{section.title}</h2>
              <p className="mt-2 whitespace-pre-line text-justify leading-6">{section.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-3 border border-black p-3 text-sm">
          <label className="flex items-start gap-2">
            <span className="mt-0.5 grid size-4 place-items-center border border-black font-serif text-xs">{record.execution_window !== "anytime" ? "X" : ""}</span>
            <span>Execution is authorized during daytime hours.</span>
          </label>
          <label className="flex items-start gap-2">
            <span className="mt-0.5 grid size-4 place-items-center border border-black font-serif text-xs">{record.execution_window === "anytime" ? "X" : ""}</span>
            <span>Execution at any time is authorized for good cause. {record.night_execution_reason}</span>
          </label>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-8 text-sm">
          <FieldLine label="Issued date and time" value={issueDate} />
          <FieldLine label="Execution deadline" value={expiresAt} />
          <FieldLine label="City and state" value={record.city_state} />
          <FieldLine label="Attorney for the government" value={record.attorney_name} />
        </section>

        <section className="mt-14 grid grid-cols-[1fr_240px] gap-10 text-sm">
          <div>
            <p className="border-b border-black pb-2 text-center">&nbsp;</p>
            <p className="mt-2 text-center font-serif">Judge&apos;s signature</p>
          </div>
          <div>
            <p className="font-serif font-bold">{record.judge_name || "Judge or Magistrate Judge"}</p>
            <p>{record.judge_title || "United States Magistrate Judge"}</p>
          </div>
        </section>

        <section className="mt-10 avoid-break">
          <h2 className="border-b border-black pb-1 text-center font-serif text-sm font-bold uppercase">Attachments</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {template.attachments.map((attachment) => (
              <p key={attachment} className="flex justify-between border-b border-dotted border-slate-500 pb-1">
                <span>{attachment}</span><span>{record.case_number || record.warrant_number || "Pending"}</span>
              </p>
            ))}
          </div>
        </section>

        <footer className="absolute inset-x-[54px] bottom-8 border-t border-black pt-2 text-center text-[10px] font-bold uppercase tracking-wide">
          <p>{ROLEPLAY_DOCUMENT_NOTICE}</p>
          <p className="mt-1 normal-case font-normal">Developed by: kcobainn</p>
        </footer>
      </div>
    </article>
  );
}

function LineValue({ value }: { value?: string }) {
  return <span className="inline-block min-w-32 border-b border-black px-2 font-semibold">{value || " "}</span>;
}

function FieldLine({ label, value }: { label: string; value?: string }) {
  return <div><p className="text-[10px] uppercase tracking-wide text-slate-700">{label}</p><p className="min-h-7 border-b border-black pt-1">{value || " "}</p></div>;
}

function formatDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
