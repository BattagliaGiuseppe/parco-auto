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
  neutral: "",
  green: "text-emerald-700",
  yellow: "text-amber-700",
  red: "text-red-700",
  blue: "text-blue-700",
};

export default function StatsGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="group rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-muted)] p-5 transition hover:-translate-y-0.5 hover:bg-[var(--surface-card)] hover:shadow-[var(--shadow-soft)]"
        >
          <div className="flex items-center gap-3 text-sm font-semibold text-[var(--text-secondary)]">
            {item.icon ? (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl border"
                style={{
                  backgroundColor: "var(--brand-accent-soft)",
                  borderColor: "var(--brand-accent-soft)",
                  color: "var(--brand-primary)",
                }}
              >
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
          </div>
          <div
            className={`technical-number mt-4 text-3xl font-black tracking-tight text-[var(--text-primary)] ${
              item.tone ? toneClassName[item.tone] : ""
            } ${item.valueClassName || ""}`.trim()}
          >
            {item.value}
          </div>
          {item.helper ? (
            <div className="mt-2 text-sm leading-5 text-[var(--text-secondary)]">{item.helper}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
