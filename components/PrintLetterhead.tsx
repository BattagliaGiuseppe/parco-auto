"use client";

import { useBrandTheme } from "@/components/providers/BrandThemeProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

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
  const { t, language } = useLanguage();
  const today = new Date().toLocaleDateString(language === "it" ? "it-IT" : language);
  const { theme } = useBrandTheme();
  const mode = theme.brandingConfig.printLetterheadMode || "logo_title_subtitle";
  const logoSrc =
    theme.printLogoUrl || theme.headerLogoUrl || theme.sidebarLogoUrl || "/logo.png";
  const showLogo = theme.brandingConfig.showLogoInPrint && mode !== "title_only";
  const showSubtitle = mode === "logo_title_subtitle";

  return (
    <div className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-6 shadow-sm print:rounded-none print:border print:border-[var(--border-default)] print:bg-white print:p-0 print:shadow-none">
      <div className="p-6 print:p-5">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            {showLogo ? (
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)]">
                <img
                  src={logoSrc}
                  alt={theme.teamName}
                  className="h-16 w-16 object-contain p-2"
                />
              </div>
            ) : null}
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                {t("common.team", "team")}
              </div>
              <div className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                {theme.teamName}
              </div>
              {showSubtitle ? (
                <div className="mt-1 text-sm text-[var(--text-secondary)]">
                  {subtitle ? t(`ui.${subtitle}`, subtitle) : theme.teamSubtitle || ""}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid min-w-[220px] grid-cols-1 gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-secondary)]">
            <MetaRow label={t("print.document", "Documento")} value={t(`ui.${title}`, title)} />
            <MetaRow label={t("print.date", "Data stampa")} value={today} />
            {rightMeta.map((item) => (
              <MetaRow key={`${item.label}-${item.value}`} label={t(`ui.${item.label}`, item.label)} value={item.value} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-[var(--border-default)] pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
        {t(`ui.${label}`, label)}
      </span>
      <span className="text-right font-semibold text-[var(--text-primary)]">{t(`ui.${value}`, value)}</span>
    </div>
  );
}
