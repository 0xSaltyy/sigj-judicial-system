import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return new NextResponse("Supabase no está configurado.", { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Authentication required", { status: 401 });

  const { data: evidence, error } = await supabase
    .from("evidence_items")
    .select("id,ete_id,formal_title,storage_bucket,storage_path,original_filename,mime_type,deleted_at,archived_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !evidence || evidence.deleted_at) return new NextResponse("Evidence not found", { status: 404 });
  if (!evidence.storage_bucket || !evidence.storage_path) return new NextResponse("Evidence file not available", { status: 404 });

  await admin.from("evidence_access_logs").insert({
    evidence_id: id,
    action: "download_link_created",
    actor_id: user.id,
    storage_bucket: evidence.storage_bucket,
    storage_path: evidence.storage_path,
    user_agent: request.headers.get("user-agent"),
  });

  const { data, error: signedError } = await admin.storage.from(evidence.storage_bucket).createSignedUrl(evidence.storage_path, 120, {
    download: evidence.original_filename || `${evidence.ete_id || "evidence"}`,
  });
  if (signedError || !data?.signedUrl) return new NextResponse("Could not create signed URL", { status: 500 });
  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
