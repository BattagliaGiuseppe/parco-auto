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
      <span className="text-sm font-bold text-[var(--text-primary)]">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-[var(--text-secondary)]">{hint}</span> : null}
    </label>
  );
}

export const uiInputClassName =
  "w-full rounded-2xl border border-[var(--border-default)] bg-[rgba(14,20,27,0.82)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm outline-none transition placeholder:text-white/30 focus:border-[var(--brand-accent)] focus:ring-4 focus:ring-[var(--brand-accent-soft)]";

export const uiTextareaClassName =
  "min-h-24 w-full rounded-2xl border border-[var(--border-default)] bg-[rgba(14,20,27,0.82)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm outline-none transition placeholder:text-white/30 focus:border-[var(--brand-accent)] focus:ring-4 focus:ring-[var(--brand-accent-soft)]";
