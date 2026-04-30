import type { ReactNode } from "react";

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center">
      <div className="text-lg font-bold text-neutral-900">{title}</div>
      {description ? <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
