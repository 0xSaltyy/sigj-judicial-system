import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { siteUrl } from "@/lib/site-url";

export function createSecureToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashSecret(token) };
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function maskEmail(value?: string | null) {
  if (!value) return null;
  const [local, domain] = value.trim().toLowerCase().split("@");
  if (!local || !domain) return null;
  return `${local.slice(0, 1)}${"•".repeat(Math.max(4, Math.min(10, local.length - 1)))}@${domain}`;
}

export function appUrl(path: string) {
  return siteUrl(path);
}

export function verificationCode() {
  return `SIG-${randomBytes(8).toString("hex").toUpperCase()}`;
}
