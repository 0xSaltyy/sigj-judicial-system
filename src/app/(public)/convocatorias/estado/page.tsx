import type { Metadata } from "next";
import { ApplicationStatusLookup } from "@/components/application-status-lookup";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = {
  title: "Estado de mi postulación",
  robots: { index: false, follow: false },
};

export default function ApplicationStatusPage() {
  return (
    <>
      <PageHero
        title="Estado de mi postulación"
        description="Panel público y privado para consultar el avance de una postulación mediante código de seguimiento."
      />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <ApplicationStatusLookup />
      </main>
    </>
  );
}
