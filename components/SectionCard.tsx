import { ReactNode } from "react";

export default function SectionCard({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
      {title && (
        <div className="mb-4">
          <h2 className="font-bold text-neutral-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-neutral-500">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}