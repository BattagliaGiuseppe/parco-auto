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
    <div
      className={`flex flex-col gap-4 rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] shadow-sm lg:flex-row lg:items-center lg:justify-between ${
        compact ? "p-5" : "p-6"
      }`}
    >
      <div className="flex min-w-0 items-start gap-4">
        {icon ? (
          <div
            className={`flex shrink-0 items-center justify-center rounded-3xl shadow-sm ${
              compact ? "h-12 w-12" : "h-14 w-14"
            }`}
            style={{
              backgroundColor: "var(--brand-accent-soft)",
              color: "var(--brand-accent)",
            }}
          >
            {icon}
          </div>
        ) : null}

        <div className="min-w-0">
          {theme.brandingConfig.showLogoInHeader ? (
            <div className="mb-3 inline-flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-[var(--surface-card)]">
                <img
                  src={theme.headerLogoUrl || "/logo.png"}
                  alt={theme.teamName}
                  className="h-6 w-6 object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  team
                </div>
                <div className="truncate text-sm font-bold text-[var(--text-primary)]">
                  {theme.teamName}
                </div>
              </div>
            </div>
          ) : null}

          <h1
            className={`racing-heading font-black tracking-tight text-[var(--text-primary)] ${
              compact ? "text-[28px]" : "text-3xl"
            }`}
          >
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
