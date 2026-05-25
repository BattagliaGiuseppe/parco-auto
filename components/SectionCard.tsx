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
    <section className={`race-section-card p-5 md:p-6 ${className}`.trim()}>
      {title || subtitle || actions ? (
        <div className="mb-5 flex flex-col gap-4 border-b border-[var(--border-default)] pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {title ? (
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-accent)] shadow-[0_0_0_4px_var(--brand-accent-soft)]" />
                <h2 className="racing-heading text-[24px] font-bold leading-none tracking-tight text-[var(--text-primary)] md:text-[28px]">
                  {title}
                </h2>
              </div>
            ) : null}
            {subtitle ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
