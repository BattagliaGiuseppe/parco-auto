import type { ReactNode } from "react";
import { X } from "lucide-react";

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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className={`modal-panel dark-scrollbar max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-[28px] p-6`}>
        <div className="flex items-start justify-between gap-4 border-b border-white/15 pb-5">
          <div className="min-w-0">
            <div className="racing-kicker mb-2 text-[var(--brand-accent)]">Race control</div>
            <h3 className="racing-heading text-2xl font-bold uppercase italic leading-none tracking-[0.03em] text-[var(--text-primary)]">
              {title}
            </h3>
            {subtitle ? <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="race-action-secondary h-10 w-10 shrink-0 p-0"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        <div className="pt-6">{children}</div>

        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-white/15 pt-5">{footer}</div> : null}
      </div>
    </div>
  );
}
