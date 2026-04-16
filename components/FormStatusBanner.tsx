export default function FormStatusBanner({
  type,
  message,
  className = "",
}: {
  type: "success" | "error" | "info";
  message: string;
  className?: string;
}) {
  const tone =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${tone} ${className}`.trim()}>
      {message}
    </div>
  );
}
