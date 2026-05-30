"use client";

import { useEffect, useState } from "react";

export type ViewMode = "compact" | "cards";

export function usePersistedViewMode(
  storageKey: string,
  defaultValue: ViewMode = "compact",
) {
  const [viewMode, setViewModeState] = useState<ViewMode>(defaultValue);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "compact" || saved === "cards") {
        setViewModeState(saved);
      }
    } catch {
      // Local storage non disponibile: manteniamo la vista di default.
    }
  }, [storageKey]);

  function setViewMode(next: ViewMode) {
    setViewModeState(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // Ignora ambienti dove localStorage non è disponibile.
    }
  }

  return [viewMode, setViewMode] as const;
}
