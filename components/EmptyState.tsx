export default function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
      <div className="font-semibold text-neutral-900">{title}</div>
      {description ? <div className="mt-2 text-sm text-neutral-500">{description}</div> : null}
    </div>
  );
}
