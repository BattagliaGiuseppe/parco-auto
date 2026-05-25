export default function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "yellow" | "red" | "blue" | "purple";
}) {
  const classes = {
    neutral: "border-neutral-300 bg-neutral-100 text-neutral-700",
    green: "border-emerald-300 bg-emerald-50 text-emerald-700",
    yellow: "border-amber-300 bg-amber-50 text-amber-800",
    red: "border-red-300 bg-red-50 text-red-700",
    blue: "border-blue-300 bg-blue-50 text-blue-700",
    purple: "border-purple-300 bg-purple-50 text-purple-700",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${classes[tone]}`}
    >
      {label}
    </span>
  );
}
