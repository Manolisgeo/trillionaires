import { cn } from "@aperture/ui";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "text-muted",
    SCHEDULED: "text-muted",
    LIVE: "border-emerald-200 bg-emerald-50 text-emerald-800",
    PROCESSING: "border-amber-200 bg-amber-50 text-amber-800",
    COMPLETED: "border-ink/10 bg-ink/5 text-ink",
    FAILED: "border-red-200 bg-red-50 text-red-800",
    CANCELLED: "text-muted",
  };
  return <Badge className={map[status]}>{status.toLowerCase()}</Badge>;
}
