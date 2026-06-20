"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({
  label = "Imprimir",
  href,
}: {
  label?: string;
  href?: string;
}) {
  if (href) {
    return (
      <Button asChild variant="outline" className="no-print gap-2">
        <a href={href} target="_blank" rel="noreferrer">
          <Printer className="size-4" />
          {label}
        </a>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.print()}
      className="no-print gap-2"
    >
      <Printer className="size-4" />
      {label}
    </Button>
  );
}
