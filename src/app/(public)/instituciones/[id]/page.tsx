import { notFound } from "next/navigation";
import Image from "next/image";
import { Building2, CalendarDays, Megaphone, Users } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { profileAssetDataUrl } from "@/lib/profile-assets";
import { defaultJurisdiction, judicialResponsibilityLabel } from "@/lib/institutional-language";
export default async function InstitutionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const [
    { data: institution },
    { data: memberRows },
    { data: notices },
    { data: hearings },
    { data: institutionRows },
  ] = await Promise.all([
    supabase.from("public_institutions").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("public_institution_members")
      .select(
        "id,full_name,position_title,public_bio,public_phone,avatar_path,dependency_id,institution_id,is_dependency_leader",
      )
      .or(`institution_id.eq.${id},dependency_id.eq.${id}`)
      .order("full_name"),
    supabase
      .from("public_notices")
      .select("id,title,category,published_at")
      .eq("status", "Publicado")
      .order("published_at", { ascending: false })
      .limit(5),
    supabase
      .from("public_hearings")
      .select("id,title,scheduled_at,room,chamber")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(5),
    supabase.from("public_institutions").select("id,name"),
  ]);
  if (!institution) notFound();
  const members = await Promise.all(
    (memberRows ?? []).map(async (member) => ({
      ...member,
      avatar: await profileAssetDataUrl(member.avatar_path),
    })),
  );
  const institutionNames = new Map((institutionRows ?? []).map((item)=>[item.id,item.name]));
  return (
    <>
      <PageHero
        eyebrow={institution.type}
        title={institution.name}
        description={institution.description || institution.competence}
      />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5" /> Información institucional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <b>Competencia:</b> {institution.competence}
            </p>
            <p>
              <b>Jurisdicción:</b> {institution.jurisdiction || defaultJurisdiction(institution.type, institution.name)}
            </p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" /> Miembros públicos
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {members.map((m) => (
              <article
                key={m.id}
                className="flex items-center gap-3 rounded border p-3"
              >
                {m.avatar ? (
                  <Image
                    src={m.avatar}
                    alt={`Foto de ${m.full_name}`}
                    width={48}
                    height={48}
                    unoptimized
                    className="size-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-xs">
                    {m.full_name
                      .split(/\s+/)
                      .slice(0, 2)
                    .map((v: string) => v[0])
                      .join("")}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.position_title || "Miembro institucional"}{m.is_dependency_leader ? ` · ${judicialResponsibilityLabel(null, `${institution.type} ${institution.name}`)}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{institutionNames.get(m.dependency_id) || institutionNames.get(m.institution_id) || institution.name}</p>
                  {m.public_bio && <p className="mt-1 text-xs leading-5">{m.public_bio}</p>}
                  {m.public_phone && <p className="mt-1 text-xs text-muted-foreground">Oficina: {m.public_phone}</p>}
                </div>
              </article>
            ))}
            {!members.length && (
              <p className="text-sm text-muted-foreground">
                No hay miembros marcados para publicación.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-5" /> Comunicados recientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(notices ?? []).map((n) => (
              <p key={n.id} className="border-b pb-2 text-sm">
                <b>{n.title}</b>
                <span className="block text-xs text-muted-foreground">
                  {n.category}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-5" /> Audiencias públicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(hearings ?? []).map((h) => (
              <p key={h.id} className="rounded border p-3 text-sm">
                <b>{h.title}</b>
                <span className="block text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(h.scheduled_at))}{" "}
                  · {h.room}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
