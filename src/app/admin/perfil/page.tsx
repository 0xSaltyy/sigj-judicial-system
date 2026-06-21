import { Camera, PenLine, Trash2 } from "lucide-react";
import Image from "next/image";
import {
  removeDefaultSignature,
  uploadDefaultSignature,
  uploadProfilePhoto,
} from "@/app/actions/profile";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireInternalUser } from "@/lib/auth/authorization";
import { profileAssetDataUrl } from "@/lib/profile-assets";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ profile }, query] = await Promise.all([
    requireInternalUser(),
    searchParams,
  ]);
  const [avatar, signature] = await Promise.all([
    profileAssetDataUrl(profile.avatar_path),
    profileAssetDataUrl(profile.default_signature_path),
  ]);
  return (
    <>
      <AdminPageHeader
        title="Mi perfil institucional"
        description="Foto privada de cuenta y firma predeterminada bajo confirmación expresa."
      />
      <ActionMessage error={query.error} success={query.success} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="size-4" /> Foto de perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            {avatar ? (
              <Image
                src={avatar}
                alt={`Foto de ${profile.full_name}`}
                width={112}
                height={112}
                unoptimized
                className="mb-4 size-28 rounded-full border object-cover"
              />
            ) : (
              <div className="mb-4 flex size-28 items-center justify-center rounded-full bg-slate-100 text-sm text-muted-foreground">
                Sin foto
              </div>
            )}
            <form action={uploadProfilePhoto} className="space-y-3">
              <input
                type="file"
                name="photo"
                accept="image/png,image/jpeg,image/webp"
                required
                className="block w-full text-sm"
              />
              <p className="text-xs text-muted-foreground">
                PNG, JPG o WebP · máximo 1 MB.
              </p>
              <SubmitButton pendingLabel="Subiendo…">
                Subir foto de perfil
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PenLine className="size-4" /> Firma predeterminada
            </CardTitle>
          </CardHeader>
          <CardContent>
            {signature ? (
              <div className="mb-4 flex h-28 items-center justify-center rounded border bg-white p-3">
                <Image
                  src={signature}
                  alt="Firma predeterminada guardada"
                  width={420}
                  height={112}
                  unoptimized
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="mb-4 flex h-28 items-center justify-center rounded border border-dashed text-sm text-muted-foreground">
                Sin firma guardada
              </div>
            )}
            <form action={uploadDefaultSignature} className="space-y-3">
              <input
                type="file"
                name="signature"
                accept="image/png"
                required
                className="block w-full text-sm"
              />
              <p className="text-xs text-muted-foreground">
                PNG transparente · máximo 1 MB. Guardarla no firma documentos
                automáticamente.
              </p>
              <SubmitButton pendingLabel="Guardando…">
                Subir firma predeterminada
              </SubmitButton>
            </form>
            {signature && (
              <form action={removeDefaultSignature} className="mt-3">
                <Button type="submit" variant="outline">
                  <Trash2 className="size-4" /> Eliminar firma guardada
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
