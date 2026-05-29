import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

const variantClassName: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-[0_14px_28px_rgba(248,196,0,0.18)] hover:brightness-95",
  secondary:
    "border border-[var(--border-default)] bg-white/[0.055] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-white/[0.09]",
  danger:
    "border border-red-400/35 bg-red-400/10 text-red-300 hover:bg-red-400/15",
  ghost:
    "text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]",
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
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-black uppercase tracking-[0.055em] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${variantClassName[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
