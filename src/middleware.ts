import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isTechnicalPreviewHostname } from "@/lib/site-url";

function requestContext(request: NextRequest) {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const hostname = (forwardedHost || request.nextUrl.hostname)
    .replace(/:\d+$/, "")
    .toLowerCase();
  const preview = isTechnicalPreviewHostname(hostname);
  const headers = new Headers(request.headers);
  headers.set("x-sigj-hostname", hostname);
  headers.set("x-sigj-pathname", request.nextUrl.pathname);
  headers.set("x-sigj-preview", preview ? "1" : "0");
  return { headers, preview };
}

function protectPreviewResponse(response: NextResponse, preview: boolean) {
  if (preview) {
    response.headers.set(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive, nosnippet, noimageindex",
    );
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const context = requestContext(request);
  const nextResponse = () =>
    NextResponse.next({ request: { headers: context.headers } });

  if (request.nextUrl.pathname === "/estados" || request.nextUrl.pathname.startsWith("/estados/")) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/providencias";
    destination.search = "";
    return protectPreviewResponse(NextResponse.redirect(destination), context.preview);
  }
  if (request.nextUrl.pathname === "/admin/estados" || request.nextUrl.pathname.startsWith("/admin/estados/")) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/admin/dashboard";
    destination.searchParams.set("success", "Estados Judiciales fue retirado de la navegación activa");
    return protectPreviewResponse(NextResponse.redirect(destination), context.preview);
  }

  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return protectPreviewResponse(nextResponse(), context.preview);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "error",
      "El acceso interno requiere configurar Supabase",
    );
    return protectPreviewResponse(
      NextResponse.redirect(loginUrl),
      context.preview,
    );
  }

  let response = nextResponse();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = nextResponse();
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return protectPreviewResponse(
      NextResponse.redirect(loginUrl),
      context.preview,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active, role")
    .eq("id", user.id)
    .single();
  if (!profile?.is_active || profile.role === "CONSULTA_PUBLICA") {
    const denied = request.nextUrl.clone();
    denied.pathname = "/no-autorizado";
    return protectPreviewResponse(
      NextResponse.redirect(denied),
      context.preview,
    );
  }
  return protectPreviewResponse(response, context.preview);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
