"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, RESOURCE_ROLES } from "@/lib/auth/permissions";

const schema = z.object({ id: z.string().uuid().optional().or(z.literal("")), title: z.string().trim().min(5), category: z.string().trim().min(2), issuing_entity: z.string().trim().min(2), excerpt: z.string().trim().min(5).max(300), content_markdown: z.string().trim().min(20), status: z.enum(["Borrador", "Publicado"]) });
const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function saveNotice(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/comunicados/nuevo?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase, user } = await requirePermission(RESOURCE_ROLES.noticesWrite);
  const payload = { title: parsed.data.title, slug: slugify(parsed.data.title), category: parsed.data.category, issuing_entity: parsed.data.issuing_entity, excerpt: parsed.data.excerpt, content_markdown: parsed.data.content_markdown, status: parsed.data.status, published_at: parsed.data.status === "Publicado" ? new Date().toISOString() : null };
  const result = parsed.data.id ? await supabase.from("public_notices").update(payload).eq("id", parsed.data.id).select("id").single() : await supabase.from("public_notices").insert({ ...payload, created_by: user.id }).select("id").single();
  if (result.error || !result.data) redirect(`${parsed.data.id ? `/admin/comunicados/${parsed.data.id}/editar` : "/admin/comunicados/nuevo"}?error=${encodeURIComponent(result.error?.message ?? "No fue posible guardar")}`);
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (!new Set(["image/png", "image/jpeg"]).has(image.type) || image.size > 5 * 1024 * 1024) redirect(`/admin/comunicados/${result.data.id}/editar?error=La%20imagen%20debe%20ser%20PNG%20o%20JPG%20y%20pesar%20menos%20de%205%20MB`);
    const extension = image.type === "image/png" ? "png" : "jpg";
    const path = `${result.data.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("public-notices").upload(path, image, { contentType: image.type });
    if (uploadError) redirect(`/admin/comunicados/${result.data.id}/editar?error=${encodeURIComponent(uploadError.message)}`);
    const { error: imageError } = await supabase.from("public_notices").update({ image_path: path }).eq("id", result.data.id);
    if (imageError) { await supabase.storage.from("public-notices").remove([path]); redirect(`/admin/comunicados/${result.data.id}/editar?error=${encodeURIComponent(imageError.message)}`); }
  }
  revalidatePath("/admin/comunicados"); revalidatePath("/comunicados");
  redirect(`/admin/comunicados?success=${encodeURIComponent("Comunicado guardado")}`);
}
