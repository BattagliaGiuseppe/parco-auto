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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-semibold text-neutral-500">
            {item.icon ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-700">
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
          </div>
          <div className={`mt-4 text-3xl font-black tracking-tight text-neutral-950 ${item.valueClassName || ""}`.trim()}>
            {item.value}
          </div>
          {item.helper ? <div className="mt-2 text-sm text-neutral-500">{item.helper}</div> : null}
        </div>
      ))}
    </div>
  );
}
