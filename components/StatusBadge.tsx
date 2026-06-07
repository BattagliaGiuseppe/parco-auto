"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";

export default function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "yellow" | "red" | "blue" | "purple";
}) {
  const { t } = useLanguage();
  const classes = {
    neutral: "border-white/15 bg-white/[0.06] text-white/72 before:bg-white/42",
    green: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300 before:bg-emerald-400",
    yellow: "border-amber-400/35 bg-amber-400/10 text-amber-300 before:bg-amber-400",
    red: "border-red-400/35 bg-red-400/10 text-red-300 before:bg-red-400",
    blue: "border-blue-400/35 bg-blue-400/10 text-blue-300 before:bg-blue-400",
    purple: "border-purple-400/35 bg-purple-400/10 text-purple-300 before:bg-purple-400",
  } as const;

  return (
    <span
      className={`relative inline-flex items-center gap-2 rounded-md border py-1 pl-2.5 pr-3 text-[10px] font-black uppercase tracking-[0.14em] before:h-1.5 before:w-1.5 before:rounded-full ${classes[tone]}`}
    >
      {t(`ui.${label}`, label)}
    </span>
  );
}
