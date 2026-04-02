import type { ReactNode } from "react";

export default function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`}>
      {title ? (
        <div className="mb-4">
          <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-neutral-500">{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
