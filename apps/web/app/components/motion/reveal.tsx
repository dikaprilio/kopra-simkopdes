"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 28 },
  },
};

export function Stagger({
  children,
  className,
  delay,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const variants: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.06, delayChildren: delay ?? 0 },
    },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

export function FadeUp({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={fadeUpVariants}>
      {children}
    </motion.div>
  );
}
