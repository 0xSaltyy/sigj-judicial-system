import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actions, cases } from "@/lib/demo-data";

const caseNumber = z.string().trim().min(8).max(40).regex(/^[A-Z0-9-]+$/i);

export async function GET(request: Request) {
  const parsed = caseNumber.safeParse(new URL(request.url).searchParams.get("radicado"));
  if (!parsed.success) return NextResponse.json({ error: "Radicado no válido" }, { status: 400 });
  const query = parsed.data.toUpperCase();
  const supabase = await createClient();
  if (supabase) {
    let { data } = await supabase.from("public_case_lookup").select("*").eq("internal_number", query).maybeSingle();
    if (!data) ({ data } = await supabase.from("public_case_lookup").select("*").eq("judicial_number", query).maybeSingle());
    if (!data) return NextResponse.json({ case: null });
    const { data: latest } = await supabase.from("public_case_actions").select("title,description,action_date").eq("case_id", data.id).order("action_date", { ascending: false }).limit(1).maybeSingle();
    return NextResponse.json({ case: { internalNumber: data.internal_number, judicialNumber: data.judicial_number, court: data.chamber, processType: data.process_type, processSubtype: data.process_subtype, status: data.status, filedAt: data.filed_at }, latest: latest ? { title: latest.title, description: latest.description, date: latest.action_date } : null });
  }
  const record = cases.find((item) => item.publicVisibility && (item.internalNumber === query || item.judicialNumber === query));
  const latest = record ? actions.find((item) => item.caseId === record.id && item.visibility === "Pública") : null;
  return NextResponse.json({ case: record ? { internalNumber: record.internalNumber, judicialNumber: record.judicialNumber, court: record.court, processType: record.processType, processSubtype: record.processSubtype, status: record.status, filedAt: record.filedAt } : null, latest });
}
