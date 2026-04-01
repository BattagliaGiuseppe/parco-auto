import type { ReactNode } from "react";

type SectionCardProps = {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function SectionCard({ title, subtitle, icon, actions, children, className = "" }: SectionCardProps) {
  return (
    <section className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {(title || subtitle || icon || actions) && (
        <div className="border-b border-neutral-200 px-5 py-4 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              {(title || icon) && (
                <div className="flex items-center gap-2">
                  {icon ? <div className="text-yellow-600">{icon}</div> : null}
                  {title ? <h2 className="text-lg font-bold text-neutral-900 md:text-xl">{title}</h2> : null}
                </div>
              )}
              {subtitle ? <p className="mt-1 text-sm text-neutral-500">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div> : null}
          </div>
        </div>
      )}
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}
