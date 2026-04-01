import type { ReactNode } from "react";

export type StatItem = {
  label: string;
  value: string;
  icon?: ReactNode;
  hint?: string;
  valueClassName?: string;
  cardClassName?: string;
};

export default function StatsGrid({
  items,
  columnsClassName = "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
}: {
  items: StatItem[];
  columnsClassName?: string;
}) {
  return (
    <div className={`grid gap-3 ${columnsClassName}`}>
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className={`rounded-2xl border border-neutral-200 bg-neutral-50 p-4 ${item.cardClassName || ""}`}>
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            {item.icon ? <span className="text-yellow-600">{item.icon}</span> : null}
            <span>{item.label}</span>
          </div>
          <div className={`mt-2 text-xl font-bold ${item.valueClassName || "text-neutral-900"}`}>{item.value}</div>
          {item.hint ? <div className="mt-1 text-xs text-neutral-500">{item.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
