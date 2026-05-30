"use client";

import { LayoutGrid, List } from "lucide-react";
import type { ViewMode } from "@/lib/usePersistedViewMode";

type Props = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
};

export default function ViewModeToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-2xl border border-white/15 bg-white/[0.045] p-1">
      <button
        type="button"
        onClick={() => onChange("compact")}
        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold uppercase tracking-[0.16em] transition ${
          value === "compact"
            ? "bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-[0_0_18px_rgba(245,190,0,0.20)]"
            : "text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)]"
        }`}
        aria-pressed={value === "compact"}
      >
        <List size={15} />
        Sintetica
      </button>
      <button
        type="button"
        onClick={() => onChange("cards")}
        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold uppercase tracking-[0.16em] transition ${
          value === "cards"
            ? "bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-[0_0_18px_rgba(245,190,0,0.20)]"
            : "text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)]"
        }`}
        aria-pressed={value === "cards"}
      >
        <LayoutGrid size={15} />
        Schede
      </button>
    </div>
  );
}
