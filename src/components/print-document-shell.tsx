import { PrintOnLoad } from "@/components/print-on-load";

export function PrintDocumentShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="print-only-page min-h-screen bg-white">
      <PrintOnLoad />
      <div className="mx-auto w-full max-w-[210mm]">{children}</div>
    </main>
  );
}
