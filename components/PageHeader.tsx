"use client";

import type { ReactNode } from "react";
import { useBrandTheme } from "@/components/providers/BrandThemeProvider";

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
  const compact = theme.brandingConfig.compactHeader;

  return (
    <header
      className={`motorsport-panel relative overflow-hidden ${
        compact ? "p-5" : "p-6 md:p-7"
      }`}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/3 opacity-70">
        <div className="absolute right-8 top-6 h-28 w-28 rounded-full bg-[var(--brand-accent-soft)] blur-2xl" />
        <div className="absolute right-0 top-0 h-full w-px bg-[var(--brand-accent)] opacity-40" />
      </div>

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {icon ? (
            <div
              className={`flex shrink-0 items-center justify-center rounded-3xl border shadow-sm ${
                compact ? "h-12 w-12" : "h-14 w-14"
              }`}
              style={{
                backgroundColor: "var(--brand-accent-soft)",
                borderColor: "var(--brand-accent-soft)",
                color: "var(--brand-primary)",
              }}
            >
              {icon}
            </div>
          ) : null}

          <div className="min-w-0">
            {theme.brandingConfig.showLogoInHeader ? (
              <div className="mb-3 inline-flex max-w-full items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-[var(--surface-card)]">
                  <img
                    src={theme.headerLogoUrl || "/logo.png"}
                    alt={theme.teamName}
                    className="h-6 w-6 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate racing-kicker text-[var(--text-muted)]">team</div>
                  <div className="truncate text-sm font-bold text-[var(--text-primary)]">
                    {theme.teamName}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="motorsport-divider mb-3" />

            <h1
              className={`racing-heading font-black leading-tight text-[var(--text-primary)] ${
                compact ? "text-[26px]" : "text-3xl md:text-4xl"
              }`}
            >
              {title}
            </h1>

            {subtitle ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] md:text-[15px]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3 lg:justify-end">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
