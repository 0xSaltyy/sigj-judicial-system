export const OFFICIAL_SITE_URL = "https://palaciodejusticia.fyi";

function validConfiguredUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    // A generated Vercel hostname must never become the canonical origin.
    if (url.hostname.toLowerCase().endsWith(".vercel.app")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function siteOrigin() {
  return validConfiguredUrl() ?? OFFICIAL_SITE_URL;
}

export function siteUrl(path = "/") {
  return new URL(path, `${siteOrigin()}/`).toString();
}

export function requestHostname(headers: Pick<Headers, "get">) {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || headers.get("host") || "";
  return host.replace(/^\[/, "").replace(/\](:\d+)?$/, "").split(":")[0].toLowerCase();
}

export function isTechnicalPreviewHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  return normalized.endsWith(".vercel.app");
}

