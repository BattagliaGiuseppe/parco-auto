export default function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "yellow" | "red" | "blue" | "purple";
}) {
  const classes = {
    neutral: "bg-neutral-100 text-neutral-700",
    green: "bg-emerald-100 text-emerald-700",
    yellow: "",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
  } as const;

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone === "yellow" ? "" : classes[tone]}`}
      style={
        tone === "yellow"
          ? {
              backgroundColor: "var(--brand-accent-soft)",
              color: "var(--brand-accent)",
            }
          : undefined
      }
    >
      {label}
    </span>
  );
}
