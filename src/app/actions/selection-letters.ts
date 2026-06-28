"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { dbUuid } from "@/lib/validation";

export async function generateSelectionLetter(formData: FormData) {
  const parsed = z
    .object({
      application_id: dbUuid,
      process_id: dbUuid,
      letter_type: z.enum(["aceptacion", "no_seleccion", "entrevista", "continuacion"]),
      body: z.string().trim().max(5000).optional(),
      public_visible: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) redirect("/admin/seleccion?error=Carta%20inv%C3%A1lida");
  const session = await requirePermission(PERMISSIONS.selectionGenerateLetters);
  const { error } = await session.supabase.rpc("generate_selection_application_letter", {
    p_application_id: parsed.data.application_id,
    p_letter_type: parsed.data.letter_type,
    p_body: parsed.data.body || "",
    p_public_visible: parsed.data.public_visible !== "false",
  });
  if (error) {
    redirect(
      `/admin/seleccion/${parsed.data.process_id}?error=${encodeURIComponent(error.message)}`,
    );
  }
  revalidatePath(`/admin/seleccion/${parsed.data.process_id}`);
  redirect(`/admin/seleccion/${parsed.data.process_id}?success=Carta%20generada`);
}
