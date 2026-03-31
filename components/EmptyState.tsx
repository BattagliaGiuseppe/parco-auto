export default function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="text-center py-10 text-neutral-500">
      <div className="font-semibold">{title}</div>
      {description && (
        <div className="text-sm mt-2">{description}</div>
      )}
    </div>
  );
}