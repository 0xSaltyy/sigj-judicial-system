import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/demo-data";
import { NOTICE_LIST_REALTIME } from "@/lib/realtime-subscriptions";
export default async function NoticesPage() {
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase
        .from("public_notices")
        .select("id,title,slug,category,issuing_entity,excerpt,published_at")
        .eq("status", "Publicado")
        .order("published_at", { ascending: false })
    : { data: [] };
  return (
    <>
      <RealtimeRefresh
        channel="public-notices"
        subscriptions={NOTICE_LIST_REALTIME}
        protectUnsavedForms={false}
      />
      <PageHero
        title="Comunicados institucionales"
        description="Avisos publicados por las dependencias del sistema."
      />
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-12 lg:grid-cols-3">
        {(data ?? []).map((n) => (
          <article key={n.id} className="rounded-lg border bg-white p-6">
            <Badge variant="outline">{n.category}</Badge>
            <Link
              href={`/comunicados/${n.slug}`}
              className="mt-5 block text-xl font-semibold text-[#153553] hover:underline"
            >
              {n.title}
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">{n.excerpt}</p>
            <p className="mt-6 text-xs text-muted-foreground">
              {n.issuing_entity} · {formatDate(n.published_at)}
            </p>
          </article>
        ))}
        {!data?.length && (
          <p className="text-sm text-muted-foreground">
            No hay comunicados publicados.
          </p>
        )}
      </div>
    </>
  );
}
