"use client";

import React from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

const variantClassName: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-[0_14px_28px_rgba(var(--brand-accent-rgb),0.18)] hover:brightness-95",
  secondary:
    "border border-white/25 bg-white/[0.075] text-[var(--text-primary)] hover:border-[var(--brand-accent)]/50 hover:bg-white/[0.12]",
  danger:
    "border border-red-400/35 bg-red-400/10 text-red-300 hover:bg-red-400/15",
  ghost:
    "text-[var(--text-secondary)] hover:bg-white/[0.075] hover:text-[var(--text-primary)]",
};

function translateReactNode(children: React.ReactNode, t: (key: string, fallback?: string) => string): React.ReactNode {
  if (typeof children === "string") {
    return t(`ui.${children}`, children);
  }

  if (Array.isArray(children)) {
    return children.map((child, index) => (
      <React.Fragment key={index}>{translateReactNode(child, t)}</React.Fragment>
    ));
  }

  return children;
}

export function Button({
  children,
  onClick,
  className = "",
  variant = "primary",
  type = "button",
  title,
  "aria-label": ariaLabel,
  ...props
}: ButtonProps) {
  const { t } = useLanguage();
  const translatedTitle = typeof title === "string" ? t(`ui.${title}`, title) : title;
  const translatedAriaLabel = typeof ariaLabel === "string" ? t(`ui.${ariaLabel}`, ariaLabel) : ariaLabel;

  return (
    <button
      type={type}
      onClick={onClick}
      title={translatedTitle}
      aria-label={translatedAriaLabel}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-black uppercase tracking-[0.055em] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${variantClassName[variant]} ${className}`.trim()}
      {...props}
    >
      {translateReactNode(children, t)}
    </button>
  );
}
