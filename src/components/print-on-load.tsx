"use client";

import { useEffect } from "react";

export function PrintOnLoad() {
  useEffect(() => {
    let cancelled = false;

    async function printWhenReady() {
      await document.fonts?.ready;
      await Promise.all(
        Array.from(document.images).map(async (image) => {
          if (image.complete) return;
          try {
            await image.decode();
          } catch {
            // The document remains printable even if a remote signature expires.
          }
        }),
      );
      if (!cancelled) window.setTimeout(() => window.print(), 150);
    }

    void printWhenReady();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
