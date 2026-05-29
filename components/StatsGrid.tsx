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
  neutral: "text-white",
  green: "text-emerald-300",
  yellow: "text-[var(--brand-accent)]",
  red: "text-red-300",
  blue: "text-blue-300",
};

const accentClassName: Record<NonNullable<StatItem["tone"]>, string> = {
  neutral: "bg-white/40",
  green: "bg-emerald-400",
  yellow: "bg-[var(--brand-accent)]",
  red: "bg-red-400",
  blue: "bg-blue-400",
};

export default function StatsGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const tone = item.tone || "neutral";
        return (
          <div key={`${item.label}-${item.value}`} className="stat-card p-5 transition hover:-translate-y-0.5">
            <div className={`absolute left-0 top-0 z-10 h-full w-1.5 ${accentClassName[tone]}`} />
            <div className="relative z-10 flex items-start justify-between gap-3 pl-2">
              <div className="min-w-0">
                <div className="racing-kicker text-[var(--text-secondary)]">{item.label}</div>
                <div
                  className={`technical-number mt-3 text-[38px] font-black leading-none tracking-tight ${toneClassName[tone]} ${
                    item.valueClassName || ""
                  }`}
                >
                  {item.value}
                </div>
              </div>
              {item.icon ? (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-white/84">
                  {item.icon}
                </span>
              ) : null}
            </div>
            {item.helper ? (
              <div className="relative z-10 mt-3 pl-2 text-sm leading-5 text-[var(--text-secondary)]">{item.helper}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
