import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <main className="space-y-5" aria-label="Cargando panel interno">
      <div className="space-y-2">
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </main>
  );
}
