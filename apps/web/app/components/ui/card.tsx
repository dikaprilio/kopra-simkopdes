import type { ReactNode } from "react";
import { cx } from "./cx";

export interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cx(
        "bg-surface-raised rounded-card border border-border-soft shadow-card p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
