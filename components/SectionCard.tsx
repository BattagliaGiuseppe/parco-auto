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
      className={`rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-soft)] md:p-6 ${className}`.trim()}
    >
      {title || subtitle || actions ? (
        <div className="mb-5 flex flex-col gap-4 border-b border-[var(--border-default)] pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-lg font-extrabold tracking-tight text-[var(--text-primary)] md:text-xl">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
