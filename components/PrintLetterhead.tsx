"use client";

import { brandConfig } from "@/lib/brand";
import { useBrandTheme } from "@/components/providers/BrandThemeProvider";

type PrintLetterheadProps = {
  title: string;
  subtitle?: string;
  rightMeta?: Array<{ label: string; value: string }>;
};

export default function PrintLetterhead({
  title,
  subtitle,
  rightMeta = [],
}: PrintLetterheadProps) {
  const today = new Date().toLocaleDateString("it-IT");
  const { theme } = useBrandTheme();
  const mode = theme.brandingConfig.printLetterheadMode || "logo_title_subtitle";
  const showLogo = theme.brandingConfig.showLogoInPrint && mode !== "title_only";
  const showSubtitle = mode === "logo_title_subtitle";

  return (
    <div className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-6 shadow-sm print:rounded-none print:border print:border-[var(--border-default)] print:shadow-none print:p-0">
      <div className="p-6 print:p-5">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            {showLogo ? (
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)]">
                <img
                  src={theme.printLogoUrl || theme.headerLogoUrl || theme.sidebarLogoUrl || "/logo.png"}
                  alt={theme.teamName}
                  className="h-16 w-16 object-contain p-2"
                />
              </div>
            ) : null}
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                team
              </div>
              <div className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                {theme.teamName}
              </div>
              {showSubtitle ? (
                <div className="mt-1 text-sm text-[var(--text-secondary)]">
                  {subtitle || theme.teamSubtitle || ""}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid min-w-[220px] grid-cols-1 gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-secondary)]">
            <MetaRow label="Documento" value={title} />
            <MetaRow label="Data stampa" value={today} />
            {rightMeta.map((item) => (
              <MetaRow key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-[var(--border-default)] px-6 py-4 print:px-5">
        <div className="flex flex-col gap-2 text-xs text-[var(--text-secondary)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <img
              src={brandConfig.logoPath}
              alt={brandConfig.appName}
              className="h-4 w-4 object-contain"
            />
            <span className="font-semibold text-[var(--text-primary)]">{brandConfig.appName}</span>
          </div>
          <div>© {new Date().getFullYear()} {brandConfig.appName}. Tutti i diritti riservati.</div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-[var(--border-default)] pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
        {label}
      </span>
      <span className="text-right font-semibold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
