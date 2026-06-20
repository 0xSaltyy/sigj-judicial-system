import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/demo-data";
import { PROCEEDING_LIST_REALTIME } from "@/lib/realtime-subscriptions";
export default async function ProceedingsPage() {
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase
        .from("public_proceedings")
        .select("*")
        .order("published_at", { ascending: false })
    : { data: [] };
  return (
    <>
      <RealtimeRefresh
        channel="public-proceedings"
        subscriptions={PROCEEDING_LIST_REALTIME}
        protectUnsavedForms={false}
      />
      <PageHero
        eyebrow="Relatoría"
        title="Biblioteca de providencias"
        description="Providencias publicadas y expresamente públicas."
      />
      <div className="mx-auto max-w-6xl divide-y rounded-lg border bg-white px-4 py-12">
        {(data ?? []).map((p) => (
          <article key={p.id} className="p-6">
            <p className="text-xs uppercase text-[#98712b]">
              {p.type} · {p.chamber}
            </p>
            <Link
              href={`/providencias/${p.id}`}
              className="mt-2 block text-lg font-semibold text-[#153553] hover:underline"
            >
              {p.title}
            </Link>
            <p className="mono-number mt-2 text-xs text-muted-foreground">
              {p.providence_number} · {p.internal_number} ·{" "}
              {formatDate(p.published_at)}
            </p>
          </article>
        ))}
        {!data?.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No hay providencias públicas.
          </p>
        )}
      </div>
    </>
  );
}
