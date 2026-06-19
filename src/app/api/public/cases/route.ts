import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const searchTerm = z.string().trim().min(5).max(60).regex(/^[A-Z0-9-]+$/i);
export async function GET(request: Request) {
  const parsed = searchTerm.safeParse(new URL(request.url).searchParams.get("radicado"));
  if (!parsed.success) return NextResponse.json({ error: "Número de consulta no válido" }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "La consulta pública no está configurada" }, { status: 503 });
  const query = parsed.data.toUpperCase();
  let { data: record } = await supabase.from("public_case_lookup").select("*").eq("internal_number", query).maybeSingle();
  if (!record) ({ data: record } = await supabase.from("public_case_lookup").select("*").eq("judicial_number", query).maybeSingle());
  if (!record) {
    const { data: proceeding } = await supabase.from("public_proceedings").select("case_id").eq("providence_number", query).maybeSingle();
    if (proceeding) ({ data: record } = await supabase.from("public_case_lookup").select("*").eq("id", proceeding.case_id).maybeSingle());
  }
  if (!record) return NextResponse.json({ case: null, actions: [], hearings: [], proceedings: [] });
  const [{ data: actions }, { data: hearings }, { data: proceedings }] = await Promise.all([
    supabase.from("public_case_actions").select("id,title,description,action_date,action_type").eq("case_id", record.id).order("action_date", { ascending: false }),
    supabase.from("public_hearings").select("id,title,hearing_type,scheduled_at,room,status").eq("case_id", record.id).order("scheduled_at", { ascending: false }),
    supabase.from("public_proceedings").select("id,providence_number,title,type,chamber,published_at").eq("case_id", record.id).order("published_at", { ascending: false }),
  ]);
  return NextResponse.json({ case: { internalNumber: record.internal_number, judicialNumber: record.judicial_number, court: record.chamber, processType: record.process_type, processSubtype: record.process_subtype, status: record.status, filedAt: record.filed_at }, actions: actions ?? [], hearings: hearings ?? [], proceedings: proceedings ?? [] });
}
