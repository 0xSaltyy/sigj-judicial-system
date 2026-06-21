import { NextResponse, type NextRequest } from "next/server";
import type { AuthenticatedProfile } from "@/lib/auth/authorization";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  if (!supabase)
    return NextResponse.json({ error: "Supabase no está configurado" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,dependency_id,position_title,is_active,is_owner")
    .eq("id", user.id)
    .maybeSingle();
  const download = request.nextUrl.searchParams.get("download") === "1";
  const authenticatedProfile = profile as AuthenticatedProfile;
  const allowed = profile?.is_active &&
    await can(authenticatedProfile, "view", "documentos", { supabase }) &&
    await can(authenticatedProfile, download ? "download" : "preview", "documentos", { supabase });
  if (!allowed) {
    await supabase.rpc("log_security_event", {
      p_action: "PERMISSION_DENIED",
      p_table: "documents",
      p_record_id: null,
      p_description: "Intento de abrir un documento sin permiso",
      p_metadata: { action: download ? "download" : "preview" },
    });
    return NextResponse.json({ error: "No tiene permiso para consultar documentos" }, { status: 403 });
  }

  const { id } = await params;
  const { data: document, error } = await supabase
    .from("documents")
    .select("id,file_path,original_name,case_id,archived_at,deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !document || document.archived_at || document.deleted_at)
    return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });

  const { data, error: signedError } = await supabase.storage
    .from("case-documents")
    .createSignedUrl(document.file_path, 600, {
      download: download ? (document.original_name || true) : false,
    });
  if (signedError || !data?.signedUrl)
    return NextResponse.json(
      { error: "No fue posible abrir el archivo en este momento" },
      { status: 503 },
    );

  await supabase.rpc("log_security_event", {
    p_action: download ? "DOCUMENT_DOWNLOADED" : "DOCUMENT_PREVIEWED",
    p_table: "documents",
    p_record_id: document.id,
    p_description: download ? "Documento descargado" : "Documento consultado",
    p_metadata: { case_id: document.case_id },
  });

  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
