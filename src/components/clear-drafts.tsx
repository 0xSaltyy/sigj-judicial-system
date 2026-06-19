"use client";

import { useEffect } from "react";

export function ClearDrafts({ storageKeys }: { storageKeys: string[] }) {
  useEffect(() => {
    storageKeys.forEach((key) => sessionStorage.removeItem(key));
  }, [storageKeys]);
  return null;
}
