import type { ReactNode } from "react";

export default function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
      {icon ? <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-yellow-600 shadow-sm">{icon}</div> : null}
      <h3 className="text-base font-bold text-neutral-900">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
