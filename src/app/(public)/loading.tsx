import { Skeleton } from "@/components/ui/skeleton";

export default function PublicLoading() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-12 sm:px-6 lg:px-8" aria-label="Cargando contenido público">
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-xl" />
        ))}
      </div>
    </main>
  );
}
