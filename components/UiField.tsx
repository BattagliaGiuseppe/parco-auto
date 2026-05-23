import type { ReactNode } from "react";

export function UiField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-[var(--text-secondary)]">{hint}</span> : null}
    </label>
  );
}

export const uiInputClassName =
  "w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm outline-none transition focus:border-[var(--brand-accent)] focus:ring-4 focus:ring-[var(--brand-accent-soft)]";

export const uiTextareaClassName =
  "min-h-24 w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm outline-none transition focus:border-[var(--brand-accent)] focus:ring-4 focus:ring-[var(--brand-accent-soft)]";
