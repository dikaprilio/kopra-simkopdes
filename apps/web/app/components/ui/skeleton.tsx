import { cx } from "./cx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx("animate-shimmer rounded-xl bg-surface-sunken", className)}
      aria-hidden="true"
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-card border border-border-soft bg-surface-raised p-5 shadow-card">
      <Skeleton className="h-9 w-9" />
      <Skeleton className="mt-4 h-3 w-24" />
      <Skeleton className="mt-2 h-7 w-32" />
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  };
  return (
    <div className="overflow-hidden rounded-card border border-border-soft bg-surface-raised p-0 shadow-card">
      <div
        className="grid gap-4 border-b border-border-soft px-4 py-3"
        style={gridStyle}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-2/3" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4 border-b border-border-soft/70 px-4 py-3 last:border-b-0"
          style={gridStyle}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
