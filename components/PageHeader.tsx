"use client";

import { ReactNode } from "react";

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
      <div className="flex items-start gap-3">
        {icon && (
          <div className="bg-yellow-400 text-black p-2 rounded-xl">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}