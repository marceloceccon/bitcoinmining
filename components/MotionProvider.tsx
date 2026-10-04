"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

/** Lean motion setup: only the DOM animation features, loaded once; honours reduced motion. */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
