"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateKnownText } from "@/lib/i18n";

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const { language } = useLanguage();
  const translatedTitle = translateKnownText(title, language);
  const translatedDescription = description ? translateKnownText(description, language) : description;

  return (
    <div className="rounded-[24px] border border-dashed border-[var(--border-strong)] bg-[rgba(255,255,255,0.035)] px-6 py-10 text-center">
      <div className="mx-auto mb-4 h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-inner">
        <div className="h-full w-full rounded-xl bg-[var(--brand-accent)]/80" />
      </div>
      <div className="text-lg font-extrabold uppercase tracking-[0.04em] text-[var(--text-primary)]">{translatedTitle}</div>
      {description ? (
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{translatedDescription}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
