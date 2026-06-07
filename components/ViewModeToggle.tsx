"use client";

import { LayoutGrid, List } from "lucide-react";
import type { ViewMode } from "@/lib/usePersistedViewMode";
import { useLanguage } from "@/components/providers/LanguageProvider";

type Props = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
};

export default function ViewModeToggle({ value, onChange }: Props) {
  const { t } = useLanguage();

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
        aria-label={t("view.compact", "Sintetica")}
        title={t("view.compact", "Sintetica")}
      >
        <List size={15} />
        {t("view.compact", "Sintetica")}
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
        aria-label={t("view.cards", "Schede")}
        title={t("view.cards", "Schede")}
      >
        <LayoutGrid size={15} />
        {t("view.cards", "Schede")}
      </button>
    </div>
  );
}
