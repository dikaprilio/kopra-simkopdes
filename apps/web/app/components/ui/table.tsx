import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "./cx";

type Align = "left" | "center" | "right";

const alignClass: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function TableCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-x-auto rounded-card border border-border-soft bg-surface-raised p-0 shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Table({
  className,
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cx("w-full border-collapse text-sm", className)}
      {...props}
    >
      {children}
    </table>
  );
}

export function THead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <thead
      className={cx(
        "border-b border-border-soft text-xs font-bold uppercase tracking-wide text-ink-muted",
        className,
      )}
    >
      {children}
    </thead>
  );
}

export function TR({
  selected,
  clickable,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & {
  selected?: boolean;
  clickable?: boolean;
}) {
  return (
    <tr
      className={cx(
        "border-b border-border-soft/70 transition-colors last:border-b-0",
        clickable && "cursor-pointer hover:bg-primary-50/60",
        selected &&
          "bg-primary-50 shadow-[inset_3px_0_0_var(--color-primary-500)]",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TH({
  align = "left",
  className,
  children,
  ...props
}: Omit<ThHTMLAttributes<HTMLTableCellElement>, "align"> & {
  align?: Align;
}) {
  return (
    <th className={cx("px-4 py-3", alignClass[align], className)} {...props}>
      {children}
    </th>
  );
}

export function TD({
  align = "left",
  numeric,
  className,
  children,
  ...props
}: Omit<TdHTMLAttributes<HTMLTableCellElement>, "align"> & {
  align?: Align;
  numeric?: boolean;
}) {
  return (
    <td
      className={cx(
        "px-4 py-3",
        numeric ? "text-right tabular-nums" : alignClass[align],
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function TableEmpty({
  icon: Icon,
  title,
  hint,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {Icon ? (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <Icon size={20} strokeWidth={2.25} />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-bold text-ink">{title}</p>
        {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
      </div>
    </div>
  );
}
