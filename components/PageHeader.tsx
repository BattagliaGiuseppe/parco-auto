"use client";

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
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        {icon ? (
          <div className="rounded-2xl bg-yellow-400 p-2 text-black shadow-sm">{icon}</div>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-neutral-900 truncate">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-neutral-500">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
