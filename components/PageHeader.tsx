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
    <div className="flex flex-col gap-4 rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {icon ? (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-yellow-100 text-neutral-900 shadow-sm">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-neutral-950">{title}</h1>
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
