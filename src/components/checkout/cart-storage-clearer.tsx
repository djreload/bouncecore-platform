"use client";

import { useEffect } from "react";

export function CartStorageClearer({ storageKey }: { storageKey: string }) {
  useEffect(() => {
    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  return null;
}
