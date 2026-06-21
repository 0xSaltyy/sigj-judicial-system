import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function profileAssetDataUrl(path: string | null | undefined) {
  if (!path) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage.from("profile-assets").download(path);
  if (error || !data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length > 2 * 1024 * 1024) return null;
  return `data:${data.type || "image/png"};base64,${bytes.toString("base64")}`;
}
