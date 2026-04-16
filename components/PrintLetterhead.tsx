import Image from "next/image";
import { brandConfig } from "@/lib/brand";

type PrintLetterheadProps = {
  title: string;
  subtitle?: string;
  rightMeta?: Array<{ label: string; value: string }>;
};

export default function PrintLetterhead({
  title,
  subtitle,
  rightMeta = [],
}: PrintLetterheadProps) {
  const today = new Date().toLocaleDateString("it-IT");

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm print:rounded-none print:border-b print:border-x-0 print:border-t-0 print:shadow-none print:p-0 print:pb-5">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
            <Image
              src={brandConfig.logoPath}
              alt={brandConfig.appName}
              fill
              sizes="64px"
              className="object-contain p-2"
            />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
              {brandConfig.vendorName}
            </div>
            <div className="mt-1 text-2xl font-black text-neutral-950">
              {brandConfig.appName}
            </div>
            <div className="mt-1 text-sm text-neutral-600">
              {subtitle || brandConfig.appDescription}
            </div>
          </div>
        </div>

        <div className="grid min-w-[220px] grid-cols-1 gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          <MetaRow label="Documento" value={title} />
          <MetaRow label="Data stampa" value={today} />
          {rightMeta.map((item) => (
            <MetaRow key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-neutral-200 pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </span>
      <span className="text-right font-semibold text-neutral-900">{value}</span>
    </div>
  );
}
