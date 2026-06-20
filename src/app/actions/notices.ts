"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { dbUuid } from "@/lib/validation";

const schema = z
  .object({
    id: dbUuid.optional().or(z.literal("")),
    title: z.string().trim().max(180),
    category: z.string().trim().max(100),
    issuing_entity: z.string().trim().max(180),
    excerpt: z.string().trim().max(300),
    content_markdown: z.string().trim().max(50000),
    status: z.enum(["Borrador", "Publicado"]),
  })
  .superRefine((value, context) => {
    if (value.status === "Publicado") {
      if (value.title.length < 5)
        context.addIssue({
          code: "custom",
          path: ["title"],
          message: "El título es obligatorio para publicar",
        });
      if (value.category.length < 2)
        context.addIssue({
          code: "custom",
          path: ["category"],
          message: "La categoría es obligatoria para publicar",
        });
      if (value.content_markdown.length < 20)
        context.addIssue({
          code: "custom",
          path: ["content_markdown"],
          message:
            "El contenido debe tener al menos 20 caracteres para publicar",
        });
    }
  });
const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export async function saveNotice(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(
      `/admin/comunicados/nuevo?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  const requirement = parsed.data.status === "Publicado"
    ? PERMISSIONS.noticesPublish
    : parsed.data.id
      ? PERMISSIONS.noticesEdit
      : PERMISSIONS.noticesCreate;
  const { supabase, user } = await requirePermission(requirement);
  const payload = {
    title: parsed.data.title || "Comunicado sin título",
    slug: slugify(parsed.data.title || `borrador-${crypto.randomUUID()}`),
    category: parsed.data.category || "Institucional",
    issuing_entity: parsed.data.issuing_entity || "Palacio Judicial",
    excerpt: parsed.data.excerpt || null,
    content_markdown: parsed.data.content_markdown || "# Borrador\n",
    status: parsed.data.status,
    published_at:
      parsed.data.status === "Publicado" ? new Date().toISOString() : null,
  };
  const result = parsed.data.id
    ? await supabase
        .from("public_notices")
        .update(payload)
        .eq("id", parsed.data.id)
        .select("id")
        .single()
    : await supabase
        .from("public_notices")
        .insert({ ...payload, created_by: user.id })
        .select("id")
        .single();
  if (result.error || !result.data)
    redirect(
      `${parsed.data.id ? `/admin/comunicados/${parsed.data.id}/editar` : "/admin/comunicados/nuevo"}?error=${encodeURIComponent(result.error?.message ?? "No fue posible guardar")}`,
    );
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (
      !new Set(["image/png", "image/jpeg"]).has(image.type) ||
      image.size > 5 * 1024 * 1024
    )
      redirect(
        `/admin/comunicados/${result.data.id}/editar?error=La%20imagen%20debe%20ser%20PNG%20o%20JPG%20y%20pesar%20menos%20de%205%20MB`,
      );
    const extension = image.type === "image/png" ? "png" : "jpg";
    const path = `${result.data.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("public-notices")
      .upload(path, image, { contentType: image.type });
    if (uploadError)
      redirect(
        `/admin/comunicados/${result.data.id}/editar?error=${encodeURIComponent(uploadError.message)}`,
      );
    const { error: imageError } = await supabase
      .from("public_notices")
      .update({ image_path: path })
      .eq("id", result.data.id);
    if (imageError) {
      await supabase.storage.from("public-notices").remove([path]);
      redirect(
        `/admin/comunicados/${result.data.id}/editar?error=${encodeURIComponent(imageError.message)}`,
      );
    }
  }
  revalidatePath("/admin/comunicados");
  revalidatePath("/comunicados");
  redirect(
    `/admin/comunicados?success=${encodeURIComponent("Comunicado guardado")}`,
  );
}
