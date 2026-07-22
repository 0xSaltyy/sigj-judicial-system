import { Skeleton } from "@/components/ui/skeleton";

export function AdminRouteLoading({
  title = "Cargando módulo…",
  detail = "Preparando datos institucionales protegidos.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="space-y-5" aria-label={title}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <p className="sr-only">{detail}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <div className="rounded-xl border bg-white p-4">
        <Skeleton className="h-10 w-full" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PublicRouteLoading({
  title = "Cargando información pública…",
}: {
  title?: string;
}) {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10" aria-label={title}>
      <div className="rounded-2xl border bg-white p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-8 w-80 max-w-full" />
        <Skeleton className="mt-3 h-4 w-[34rem] max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    </main>
  );
}
