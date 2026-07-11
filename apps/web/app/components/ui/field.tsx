import type React from "react";
import { cx } from "./cx";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cx(
        "block text-xs font-semibold uppercase tracking-wide text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

const fieldBaseClasses = cx(
  "w-full rounded-xl border border-border-soft bg-surface-raised",
  "px-3.5 py-2.5 text-sm font-medium text-ink",
  "placeholder:text-ink-muted/70",
  "transition-colors duration-150",
  "focus:outline-none",
  "disabled:opacity-50 disabled:pointer-events-none",
);

const validFocusClasses =
  "focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/25";

const invalidClasses =
  "border-danger-600 focus:border-danger-600 focus:ring-2 focus:ring-danger-600/25";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cx(
        fieldBaseClasses,
        invalid ? invalidClasses : validFocusClasses,
        className,
      )}
      {...props}
    />
  );
}

export interface SelectNativeProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function SelectNative({
  invalid,
  className,
  ...props
}: SelectNativeProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cx(
        fieldBaseClasses,
        invalid ? invalidClasses : validFocusClasses,
        className,
      )}
      {...props}
    />
  );
}

export interface FieldErrorProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

export function FieldError({ className, children, ...props }: FieldErrorProps) {
  if (!children) return null;
  return (
    <p
      className={cx("text-xs font-semibold text-danger-600", className)}
      {...props}
    >
      {children}
    </p>
  );
}
