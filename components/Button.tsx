import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

const variantClassName: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--brand-accent)] text-[var(--brand-on-accent)] hover:brightness-95",
  secondary:
    "border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
};

export function Button({
  children,
  onClick,
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClassName[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
