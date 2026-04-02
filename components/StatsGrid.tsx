import type { ReactNode } from "react";

export type StatItem = {
  label: string;
  value: string;
  icon?: ReactNode;
  helper?: string;
  valueClassName?: string;
};

export default function StatsGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            {item.icon}
            <span>{item.label}</span>
          </div>
          <div className={`mt-2 text-xl font-bold ${item.valueClassName || "text-neutral-900"}`}>{item.value}</div>
          {item.helper ? <div className="mt-1 text-xs text-neutral-500">{item.helper}</div> : null}
        </div>
      ))}
    </div>
  );
}
