import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeDestination(request: NextRequest) {
  const requested =
    request.nextUrl.searchParams.get("next") ?? "/admin/dashboard";
  return requested.startsWith("/") && !requested.startsWith("//")
    ? requested
    : "/admin/dashboard";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const destination = safeDestination(request);
  if (!supabase) {
    return NextResponse.redirect(
      new URL("/login?error=Supabase%20no%20está%20configurado", request.url),
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Enlace de acceso incompleto") };

  if (result.error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("El enlace expiró o no es válido")}`,
        request.url,
      ),
    );
  }

  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = auth.user
    ? await supabase
        .from("profiles")
        .select("is_active,role")
        .eq("id", auth.user.id)
        .maybeSingle()
    : { data: null };
  if (!profile?.is_active || profile.role === "CONSULTA_PUBLICA") {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("La cuenta no tiene acceso institucional activo")}`,
        request.url,
      ),
    );
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
