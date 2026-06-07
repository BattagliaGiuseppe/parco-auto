"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateKnownText } from "@/lib/i18n";

export default function FormStatusBanner({
  type,
  message,
  className = "",
}: {
  type: "success" | "error" | "info";
  message: string;
  className?: string;
}) {
  const { language } = useLanguage();
  const classes =
    type === "success"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      : type === "error"
      ? "border-red-400/35 bg-red-400/10 text-red-100"
      : "border-[rgba(var(--brand-accent-rgb),0.32)] bg-[rgba(var(--brand-accent-rgb),0.10)] text-[var(--brand-accent)]";

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 shadow-[0_12px_34px_rgba(0,0,0,0.18)] ${classes} ${className}`.trim()}
    >
      {translateKnownText(message, language)}
    </div>
  );
}
