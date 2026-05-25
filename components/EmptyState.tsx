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
    <div className="rounded-[28px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-6 py-10 text-center">
      <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-[var(--brand-accent)]" />
      <div className="text-lg font-extrabold text-[var(--text-primary)]">{title}</div>
      {description ? (
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
