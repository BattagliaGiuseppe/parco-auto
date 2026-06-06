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

export const uiInputClassName = "form-control-dark";

export const uiSelectClassName = "form-control-dark";

export const uiTextareaClassName = "form-control-dark min-h-24";
