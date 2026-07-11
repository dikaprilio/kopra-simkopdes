import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "./cx";

export type PillVariant =
  | "blue"
  | "orange"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export interface PillProps {
  children: ReactNode;
  variant?: PillVariant;
  icon?: LucideIcon;
  className?: string;
}

const variantClasses: Record<PillVariant, string> = {
  blue: "bg-secondary-600 text-white",
  orange: "bg-primary-50 text-primary-700",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  neutral: "bg-surface-sunken text-ink-muted",
};

export function Pill({
  children,
  variant = "neutral",
  icon: Icon,
  className,
}: PillProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
        variantClasses[variant],
        className,
      )}
    >
      {Icon ? <Icon size={12} strokeWidth={2.25} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
