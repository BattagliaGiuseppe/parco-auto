import type { ReactNode } from "react";

export default function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-6 shadow-sm ${className}`.trim()}
    >
      {title || subtitle || actions ? (
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {title ? <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2> : null}
            {subtitle ? (
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
