import type React from "react";
import { cx } from "./cx";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-500 text-white hover:-translate-y-px hover:shadow-card-hover active:translate-y-0",
  secondary:
    "border border-secondary-600 text-secondary-600 hover:bg-secondary-50",
  ghost: "text-ink-muted hover:bg-surface-sunken",
  danger:
    "bg-danger-600 text-white hover:-translate-y-px hover:shadow-card-hover active:translate-y-0",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3.5 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-bold",
        "transition-[transform,box-shadow,color,background-color,border-color] duration-150",
        "disabled:opacity-50 disabled:pointer-events-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
