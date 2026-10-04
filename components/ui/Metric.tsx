"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MetricProps {
  label: string;
  value: number;
  format: (v: number) => string;
  unit?: string;
  /** Which direction is good news: drives the brief delta tint after a change */
  better?: "up" | "down" | "none";
  hint?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SETTLE_MS = 150; // wait for inputs to settle (slider drags) before animating
const ROLL_MS = 320;
const TINT_MS = 900;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A labelled figure. When its value changes it rolls to the settled value and
 * briefly tints green or red for the direction of the change (motion explains
 * cause and effect). Reduced motion: the value simply changes.
 */
export default function Metric({ label, value, format, unit, better = "none", hint, size = "md", className }: MetricProps) {
  const [shown, setShown] = useState(value);
  const [tint, setTint] = useState<"good" | "bad" | null>(null);
  const shownRef = useRef(value);

  useEffect(() => {
    if (value === shownRef.current) return;
    if (prefersReducedMotion()) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    let raf = 0;
    let tintTimer: ReturnType<typeof setTimeout> | undefined;
    const settle = setTimeout(() => {
      const from = shownRef.current;
      const to = value;
      if (better !== "none") {
        const up = to > from;
        setTint((better === "up") === up ? "good" : "bad");
        tintTimer = setTimeout(() => setTint(null), TINT_MS);
      }
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ROLL_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        const v = from + (to - from) * eased;
        shownRef.current = v;
        setShown(v);
        if (t < 1) raf = requestAnimationFrame(step);
        else shownRef.current = to;
      };
      raf = requestAnimationFrame(step);
    }, SETTLE_MS);
    return () => {
      clearTimeout(settle);
      cancelAnimationFrame(raf);
      if (tintTimer) clearTimeout(tintTimer);
    };
  }, [value, better]);

  return (
    <div className={cn("grid min-w-0 gap-0.5", className)}>
      <span className="label">{label}</span>
      <span
        className={cn(
          "font-mono font-medium tracking-tight text-fg transition-colors duration-200",
          size === "sm" && "text-base",
          size === "md" && "text-xl sm:text-2xl",
          size === "lg" && "text-3xl sm:text-4xl",
          tint === "good" && "text-good",
          tint === "bad" && "text-bad",
        )}
        aria-live="off"
      >
        {format(shown)}
        {unit && <span className="ml-1 text-[0.5em] font-normal text-muted">{unit}</span>}
      </span>
      {hint && <span className="truncate font-mono text-xs text-muted">{hint}</span>}
    </div>
  );
}
