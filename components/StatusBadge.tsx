export default function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "yellow" | "red" | "blue" | "purple";
}) {
  const classes = {
    neutral: "border-neutral-300 bg-neutral-100 text-neutral-700 before:bg-neutral-500",
    green: "border-emerald-300 bg-emerald-50 text-emerald-700 before:bg-emerald-500",
    yellow: "border-amber-300 bg-amber-50 text-amber-800 before:bg-amber-500",
    red: "border-red-300 bg-red-50 text-red-700 before:bg-red-500",
    blue: "border-blue-300 bg-blue-50 text-blue-700 before:bg-blue-500",
    purple: "border-purple-300 bg-purple-50 text-purple-700 before:bg-purple-500",
  } as const;

  return (
    <span
      className={`relative inline-flex items-center gap-2 rounded-md border py-1 pl-2.5 pr-3 text-[10px] font-black uppercase tracking-[0.14em] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] before:h-2 before:w-2 before:rounded-full ${classes[tone]}`}
    >
      {label}
    </span>
  );
}
