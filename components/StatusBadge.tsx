type StatusTone = "neutral" | "green" | "yellow" | "red" | "blue" | "purple";

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-neutral-100 text-neutral-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

export default function StatusBadge({ label, tone = "neutral", className = "" }: { label: string; tone?: StatusTone; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[tone]} ${className}`}>{label}</span>;
}
