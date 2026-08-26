import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: (items) => { items.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { const loginUrl = request.nextUrl.clone(); loginUrl.pathname = "/login"; loginUrl.searchParams.set("next", request.nextUrl.pathname); return NextResponse.redirect(loginUrl); }
  const { data: profile } = await supabase.from("profiles").select("is_active, role").eq("id", user.id).single();
  if (!profile?.is_active || profile.role === "CIUDADANO") { const denied = request.nextUrl.clone(); denied.pathname = "/no-autorizado"; return NextResponse.redirect(denied); }
  return response;
}
export const config = { matcher: ["/admin/:path*"] };
