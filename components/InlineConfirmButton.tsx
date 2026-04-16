"use client";

import { useState } from "react";

type InlineConfirmButtonProps = {
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
  label?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

export default function InlineConfirmButton({
  onConfirm,
  children,
  label,
  message,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  className = "",
  icon,
  disabled = false,
}: InlineConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (disabled || loading) return;

    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={className}
      >
        <span className="inline-flex items-center gap-2">
          {icon ? icon : null}
          <span>{children ?? label ?? "Elimina"}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-2">
      {message ? (
        <span className="text-sm font-medium text-red-700">{message}</span>
      ) : null}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={disabled || loading}
        className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        {loading ? "Attendere..." : confirmLabel}
      </button>

      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:bg-neutral-100"
      >
        {cancelLabel}
      </button>
    </div>
  );
}
