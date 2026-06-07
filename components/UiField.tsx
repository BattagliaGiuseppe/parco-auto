"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateKnownText } from "@/lib/i18n";

export function UiField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const { language } = useLanguage();

  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-[var(--text-primary)]">{translateKnownText(label, language)}</span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-[var(--text-secondary)]">{translateKnownText(hint, language)}</span> : null}
    </label>
  );
}

export const uiInputClassName = "form-control-dark";

export const uiSelectClassName = "form-control-dark";

export const uiTextareaClassName = "form-control-dark min-h-24";
