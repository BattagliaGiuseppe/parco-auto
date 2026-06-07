"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateKnownText } from "@/lib/i18n";

export default function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { language } = useLanguage();
  const translatedTitle = title ? translateKnownText(title, language) : title;
  const translatedSubtitle = subtitle ? translateKnownText(subtitle, language) : subtitle;

  return (
    <section className={`race-section-card ${className}`.trim()}>
      {title || subtitle || actions ? (
        <div className="section-card-header px-5 py-4 md:px-6">
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              {title ? (
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-accent)] shadow-[0_0_0_4px_rgba(var(--brand-accent-rgb),0.14)]" />
                  <h2 className="racing-heading text-[23px] font-bold uppercase italic leading-none tracking-[0.025em] text-[var(--brand-accent)] md:text-[26px]">
                    {translatedTitle}
                  </h2>
                </div>
              ) : null}
              {subtitle ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{translatedSubtitle}</p>
              ) : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </div>
      ) : null}
      <div className="section-card-body p-5 md:p-6">{children}</div>
    </section>
  );
}
