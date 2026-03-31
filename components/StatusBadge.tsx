export default function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "yellow" | "red";
}) {
  const styles = {
    neutral: "bg-neutral-200 text-neutral-800",
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`text-xs font-semibold px-2 py-1 rounded-full ${styles[tone]}`}
    >
      {label}
    </span>
  );
}