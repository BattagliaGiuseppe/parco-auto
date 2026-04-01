"use client";

import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
};

export default function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white/90 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 p-5 md:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {icon ? (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                {icon}
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-neutral-500 md:text-base">{subtitle}</p> : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}
