"use client";

import type { ReactNode } from "react";
import { useBrandTheme } from "@/components/providers/BrandThemeProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateKnownText } from "@/lib/i18n";

export default function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  const { theme } = useBrandTheme();
  const { language, t } = useLanguage();
  const compact = theme.brandingConfig.compactHeader;
  const translatedTitle = translateKnownText(title, language);
  const translatedSubtitle = subtitle ? translateKnownText(subtitle, language) : subtitle;

  return (
    <header className={`race-control-panel ${compact ? "p-5" : "p-6 md:p-7"}`}>
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {icon ? (
            <div
              className={`flex shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-[var(--brand-accent)] shadow-sm ${
                compact ? "h-12 w-12" : "h-14 w-14"
              }`}
            >
              {icon}
            </div>
          ) : null}

          <div className="min-w-0">
            {theme.brandingConfig.showLogoInHeader ? (
              <div className="mb-4 inline-flex max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2 shadow-sm backdrop-blur">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white/90">
                  <img
                    src={theme.headerLogoUrl || "/logo.png"}
                    alt={theme.teamName}
                    className="h-6 w-6 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate racing-kicker text-white/55">{t("common.team")}</div>
                  <div className="truncate text-sm font-extrabold text-white">
                    {theme.teamName}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mb-3 flex items-center gap-3">
              <div className="motorsport-divider" />
              <span className="hidden text-xs font-bold uppercase tracking-[0.2em] text-white/45 sm:inline">
                {t("common.raceControl", "Race control")}
              </span>
            </div>

            <h1
              className={`racing-heading font-bold uppercase leading-none tracking-[0.02em] text-white ${
                compact ? "text-[30px]" : "text-4xl md:text-[52px]"
              }`}
            >
              {translatedTitle}
            </h1>

            {subtitle ? (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/68 md:text-[15px]">
                {translatedSubtitle}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-3 lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
