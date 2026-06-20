import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { AuthenticatedProfile } from "@/lib/auth/authorization";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("id,full_name,email,role,dependency_id,position_title,is_active,is_owner").eq("id", user.id).maybeSingle();
  if (!profile?.is_active || !(await can(profile as AuthenticatedProfile, "share", "documentos", { supabase }))) {
    await supabase.rpc("log_security_event", { p_action: "PERMISSION_DENIED", p_table: "documents", p_record_id: null, p_description: "Intento de generar enlace de documento sin permiso", p_metadata: { action: "share" } });
    return NextResponse.json({ error: "No tiene permiso para compartir documentos" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { expiresIn?: number };
  const expiresIn = Math.min(3600, Math.max(300, Number(body.expiresIn) || 900));
  const { data: document, error } = await supabase.from("documents").select("id,file_path,case_id,archived_at").eq("id", id).maybeSingle();
  if (error || !document || document.archived_at) return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
  const { data, error: signedError } = await supabase.storage.from("case-documents").createSignedUrl(document.file_path, expiresIn, { download: false });
  if (signedError || !data?.signedUrl) return NextResponse.json({ error: signedError?.message ?? "No fue posible firmar el enlace" }, { status: 400 });
  await supabase.rpc("log_security_event", { p_action: "SIGNED_LINK_CREATED", p_table: "documents", p_record_id: document.id, p_description: "Enlace temporal de documento generado", p_metadata: { expires_in_seconds: expiresIn, case_id: document.case_id } });
  return NextResponse.json({ url: data.signedUrl, expiresIn });
}
