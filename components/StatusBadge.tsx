export default function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "yellow" | "red" | "blue" | "purple";
}) {
  const classes = {
    neutral: "border-neutral-200 bg-neutral-100 text-neutral-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    yellow: "",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] ${
        tone === "yellow" ? "" : classes[tone]
      }`}
      style={
        tone === "yellow"
          ? {
              backgroundColor: "var(--brand-accent-soft)",
              borderColor: "var(--brand-accent-soft)",
              color: "var(--brand-primary)",
            }
          : undefined
      }
    >
      {label}
    </span>
  );
}
