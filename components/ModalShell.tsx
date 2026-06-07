"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = "max-w-3xl",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className={`modal-panel dark-scrollbar max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-[28px] p-6`}>
        <div className="flex items-start justify-between gap-4 border-b border-white/15 pb-5">
          <div className="min-w-0">
            <h2 className="racing-heading text-3xl font-black uppercase italic text-white">{t(`ui.${title}`, title)}</h2>
            {subtitle ? <p className="mt-2 text-sm leading-6 text-white/62">{t(`ui.${subtitle}`, subtitle)}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.06] p-2 text-white/65 transition hover:bg-white/[0.12] hover:text-white"
            aria-label={t("common.close", "Chiudi")}
            title={t("common.close", "Chiudi")}
          >
            <X size={18} />
          </button>
        </div>
        <div className="py-5">{children}</div>
        {footer ? <div className="border-t border-white/15 pt-5">{footer}</div> : null}
      </div>
    </div>
  );
}
