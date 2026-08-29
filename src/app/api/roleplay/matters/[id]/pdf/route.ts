import { NextResponse } from "next/server";
import { buildDojRecordPdf } from "@/lib/doj-record-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return new NextResponse("Supabase no está configurado.", { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Authentication required", { status: 401 });
  const [{ data: matter }, complaints, cases, evidence, workflow] = await Promise.all([
    supabase.from("matters").select("*").eq("id", id).maybeSingle(),
    supabase.from("complaint_matter_links").select("relationship_type,complaints(tracking_number,category,status,submitted_at,anonymous,complainant_name,description)").eq("matter_id", id).eq("active", true),
    supabase.from("matter_case_relationships").select("relationship_type,cases(case_number,internal_number,docket_number,case_caption,title,status)").eq("matter_id", id),
    supabase.from("evidence_items").select("ete_id,formal_title,title,description,sha256_hash,evidence_status,access_classification,grand_jury_status,sealed,created_at").eq("matter_id", id).is("archived_at", null).is("deleted_at", null).neq("grand_jury_status", "Grand-jury material").eq("sealed", false).order("created_at"),
    supabase.from("workflow_events").select("occurred_at,title,event_code,new_status").eq("matter_id", id).order("occurred_at"),
  ]);
  if (!matter) return new NextResponse("Matter not found", { status: 404 });
  const profile = await supabase.from("profiles").select("full_name,role").eq("id", user.id).maybeSingle();
  await admin.from("pdf_export_audit").insert({ record_type: "matter", record_id: id, export_kind: "Matter PDF", actor_id: user.id, included_sections: ["overview","complaints","cases","evidence","timeline"], excluded_restricted: true });
  const pdf = buildDojRecordPdf({
    title: `DOJ Matter ${matter.matter_number}`,
    subtitle: matter.title,
    classification: matter.security_classification || matter.access_level || "Internal DOJ only",
    generatedBy: profile.data?.full_name || user.email || "Authorized user",
    sections: [
      { title: "Executive summary", rows: [`Matter Number: ${matter.matter_number}`, `Title: ${matter.title}`, `Status: ${matter.status}`, `Opened: ${matter.opened_at}`, `Summary: ${matter.summary || "No summary recorded."}`] },
      { title: "Related complaints", rows: (complaints.data ?? []).map((row) => {
        const c = Array.isArray(row.complaints) ? row.complaints[0] : row.complaints;
        return `${c?.tracking_number} - ${c?.category} - ${c?.status} - ${c?.anonymous ? "Anonymous" : c?.complainant_name || "No name"} - ${row.relationship_type}`;
      }) },
      { title: "Related Federal Cases", rows: (cases.data ?? []).map((row) => {
        const c = Array.isArray(row.cases) ? row.cases[0] : row.cases;
        return `${c?.case_number || c?.internal_number} - Docket: ${c?.docket_number || "No Docket Number"} - ${c?.case_caption || c?.title} - ${c?.status} - ${row.relationship_type}`;
      }) },
      { title: "Evidence Index", rows: (evidence.data ?? []).map((item) => `${item.ete_id || "No ETE"} - ${item.formal_title || item.title} - ${item.evidence_status} - hash ${(item.sha256_hash || "").slice(0, 12)} - ${item.access_classification}`) },
      { title: "Timeline", rows: (workflow.data ?? []).map((item) => `${item.occurred_at} - ${item.event_code}: ${item.title} - ${item.new_status || "No status change"}`) },
    ],
  });
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${matter.matter_number}-matter.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
