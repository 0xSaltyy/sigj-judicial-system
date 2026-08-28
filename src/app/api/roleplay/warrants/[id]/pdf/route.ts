import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWarrantPdf } from "@/lib/warrant-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });

  const { data, error } = await supabase.from("roleplay_warrants").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Warrant not found" }, { status: 404 });

  const pdf = buildWarrantPdf({ ...(typeof data.document_data === "object" && data.document_data ? data.document_data : {}), ...data });
  const filename = `${data.warrant_number || "warrant"}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, "_");

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
