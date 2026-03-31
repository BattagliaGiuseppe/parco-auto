import { ReactNode } from "react";

export type StatItem = {
  label: string;
  value: string;
  icon?: ReactNode;
};

export default function StatsGrid({
  items,
}: {
  items: StatItem[];
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-white border border-neutral-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            {item.icon}
            {item.label}
          </div>
          <div className="text-xl font-bold mt-2 text-neutral-900">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}