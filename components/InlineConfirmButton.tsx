"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

export default function InlineConfirmButton({
  label = "Elimina",
  message = "Confermi questa operazione?",
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  onConfirm,
  className = "inline-flex items-center justify-center rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100",
  compact = false,
  icon,
}: {
  label?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
  compact?: boolean;
  icon?: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className={compact ? "flex items-center gap-2" : "flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-3"}>
        <div className="flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle size={16} />
          <span>{message}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-70"
          >
            {busy ? "Attendi..." : confirmLabel}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)} className={className}>
      <span className="inline-flex items-center gap-2">
        {icon ? icon : null}
        <span>{label}</span>
      </span>
    </button>
  );
}
