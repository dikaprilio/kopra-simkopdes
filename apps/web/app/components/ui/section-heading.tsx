import { cx } from "./cx";

export interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeading({
  title,
  subtitle,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cx("flex items-center gap-3", className)}>
      <span
        aria-hidden="true"
        className="w-1.5 rounded-full bg-primary-500 self-stretch"
      />
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-ink">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-sm font-medium text-ink-muted">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
