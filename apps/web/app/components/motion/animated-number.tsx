"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { rupiah } from "../../lib/format";
import { cx } from "../ui/cx";

// Overdamped spring (damping > 2 * sqrt(stiffness)) → ease-out count-up,
// no overshoot, settles in ~0.9s.
const SPRING = { stiffness: 90, damping: 24, mass: 1 };

export function AnimatedNumber({
  value,
  format = "rupiah",
  className,
}: {
  value: number;
  format?: "rupiah" | "int";
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const spring = useSpring(0, SPRING);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      if (shouldReduceMotion) {
        // Reduced motion: show the final value immediately, no count-up.
        spring.jump(value);
      } else {
        // Kick off the one-time 0 → value count-up on mount.
        spring.set(value);
      }
      return;
    }
    // Subsequent value changes: retarget the spring from its current
    // position — never replay from 0.
    spring.set(value);
  }, [value, spring, shouldReduceMotion]);

  const display = useTransform(spring, (v) =>
    format === "int"
      ? Math.round(v).toLocaleString("id-ID")
      : rupiah(Math.round(v)),
  );

  return (
    <motion.span className={cx("tabular-nums", className)}>
      {display}
    </motion.span>
  );
}
