import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const caseNumber = z.string().trim().min(8).max(40).regex(/^[A-Z0-9-]+$/i);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = caseNumber.safeParse(params.get("case_number") || params.get("q") || params.get("docket_number"));
  if (!parsed.success) return NextResponse.json({ error: "Número de caso no válido" }, { status: 400 });
  const query = parsed.data.toUpperCase();
  const supabase = await createClient();
  if (supabase) {
    let { data } = await supabase.from("public_case_lookup").select("*").eq("case_number", query).maybeSingle();
    if (!data) ({ data } = await supabase.from("public_case_lookup").select("*").eq("internal_number", query).maybeSingle());
    if (!data) ({ data } = await supabase.from("public_case_lookup").select("*").eq("docket_number", query).maybeSingle());
    if (!data) return NextResponse.json({ case: null });
    const { data: latest } = await supabase.from("public_case_actions").select("title,description,action_date").eq("case_id", data.id).order("action_date", { ascending: false }).limit(1).maybeSingle();
    return NextResponse.json({
      case: {
        caseNumber: data.case_number || data.internal_number,
        docketNumber: data.docket_number || null,
        filingStatus: data.filing_status,
        court: data.court_name || data.court_abbreviation || "Federal court",
        caseCaption: data.case_caption || data.title,
        caseCategory: data.case_category,
        status: data.status,
        filedAt: data.filed_at,
      },
      latest: latest ? { title: latest.title, description: latest.description, date: latest.action_date } : null,
    });
  }
  return NextResponse.json({ case: null });
}
