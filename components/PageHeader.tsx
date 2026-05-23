import type { ReactNode } from "react";

export default function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {icon ? (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl shadow-sm"
            style={{
              backgroundColor: "var(--brand-accent-soft)",
              color: "var(--brand-accent)",
            }}
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
