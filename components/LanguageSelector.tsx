"use client";

import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { useLanguage } from "@/components/providers/LanguageProvider";

type LanguageSelectorProps = {
  compact?: boolean;
  className?: string;
};

export default function LanguageSelector({ compact = false, className = "" }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label
      className={`block ${className}`.trim()}
      title={t("language.current")}
      data-no-translate="true"
    >
      {!compact ? (
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
          {t("language.selector")}
        </span>
      ) : null}
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-sm font-semibold text-white outline-none transition hover:bg-white/10 focus:border-[var(--brand-accent)] focus:ring-4 focus:ring-yellow-400/15"
        aria-label={t("language.selector")}
        data-no-translate="true"
      >
        {SUPPORTED_LANGUAGES.map((item) => (
          <option key={item.code} value={item.code} className="bg-slate-950 text-white">
            {compact ? item.shortLabel : item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
