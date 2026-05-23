export default function FormStatusBanner({
  type,
  message,
  className = "",
}: {
  type: "success" | "error" | "info";
  message: string;
  className?: string;
}) {
  const classes =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "";

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${className} ${classes}`.trim()}
      style={
        type === "info"
          ? {
              borderColor: "var(--brand-accent-soft)",
              backgroundColor: "var(--brand-accent-soft)",
              color: "var(--brand-accent)",
            }
          : undefined
      }
    >
      {message}
    </div>
  );
}
