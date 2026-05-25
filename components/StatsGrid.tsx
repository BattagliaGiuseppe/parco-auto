import type { ReactNode } from "react";

export type StatItem = {
  label: string;
  value: string;
  icon?: ReactNode;
  helper?: string;
  valueClassName?: string;
  tone?: "neutral" | "green" | "yellow" | "red" | "blue";
};

const toneClassName: Record<NonNullable<StatItem["tone"]>, string> = {
  neutral: "border-neutral-200 text-neutral-800",
  green: "border-emerald-200 text-emerald-700",
  yellow: "border-amber-200 text-amber-700",
  red: "border-red-200 text-red-700",
  blue: "border-blue-200 text-blue-700",
};

const accentClassName: Record<NonNullable<StatItem["tone"]>, string> = {
  neutral: "bg-neutral-700",
  green: "bg-emerald-500",
  yellow: "bg-[var(--brand-accent)]",
  red: "bg-red-500",
  blue: "bg-blue-500",
};

export default function StatsGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const tone = item.tone || "neutral";
        return (
          <div
            key={`${item.label}-${item.value}`}
            className={`group relative overflow-hidden rounded-[22px] border bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] ${toneClassName[tone]}`}
          >
            <div className={`absolute left-0 top-0 h-full w-1.5 ${accentClassName[tone]}`} />
            <div className="flex items-start justify-between gap-3 pl-2">
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  {item.label}
                </div>
                <div
                  className={`technical-number mt-3 text-[34px] font-black leading-none tracking-tight ${
                    item.valueClassName || ""
                  }`}
                >
                  {item.value}
                </div>
              </div>
              {item.icon ? (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] text-[var(--text-primary)]">
                  {item.icon}
                </span>
              ) : null}
            </div>
            {item.helper ? (
              <div className="mt-3 pl-2 text-sm leading-5 text-[var(--text-secondary)]">{item.helper}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
