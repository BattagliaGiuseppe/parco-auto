import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

const variantClassName: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-[0_10px_22px_rgba(250,204,21,0.18)] hover:brightness-95",
  secondary:
    "border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  ghost:
    "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]",
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
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClassName[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
