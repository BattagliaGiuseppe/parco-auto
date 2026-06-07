"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function InlineConfirmButton({
  label = "Elimina",
  message = "Confermi questa operazione?",
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  onConfirm,
  className = "race-action-danger px-4 py-3 text-sm",
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
  const { t } = useLanguage();
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
      <div className={compact ? "flex items-center gap-2" : "flex flex-col gap-3 rounded-2xl border border-red-400/25 bg-red-400/10 p-3"}>
        <div className="flex items-center gap-2 text-sm font-semibold text-red-100">
          <AlertTriangle size={16} />
          <span>{t(`ui.${message}`, message)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="race-action-danger bg-red-500/20 px-4 py-2.5 text-sm disabled:opacity-70"
          >
            {busy ? t("common.wait", "Attendi...") : t(`ui.${confirmLabel}`, confirmLabel)}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="race-action-secondary px-4 py-2.5 text-sm"
          >
            {t(`ui.${cancelLabel}`, cancelLabel)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)} className={className}>
      <span className="inline-flex items-center gap-2">
        {icon ? icon : null}
        <span>{t(`ui.${label}`, label)}</span>
      </span>
    </button>
  );
}
