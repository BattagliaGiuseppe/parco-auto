"use client";

import { brandConfig } from "@/lib/brand";

export default function PrintDocumentFooter() {
  return (
    <div className="border-t border-dashed border-[var(--border-default)] px-1 py-4">
      <div className="flex flex-col gap-2 text-xs text-[var(--text-secondary)] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <img
            src={brandConfig.logoPath}
            alt={brandConfig.appName}
            className="h-4 w-4 object-contain"
          />
          <span className="font-semibold text-[var(--text-primary)]">
            {brandConfig.appName}
          </span>
        </div>
        <div>
          © {new Date().getFullYear()} {brandConfig.appName}. Tutti i diritti riservati.
        </div>
      </div>
    </div>
  );
}
