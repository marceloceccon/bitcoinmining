"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  className?: string;
  /** Accessible name of the trigger, e.g. "About network growth" */
  label?: string;
}

/**
 * Help tooltip. Opens on hover and keyboard focus, and toggles on tap (touch has
 * no hover). The bubble is linked to its trigger with aria-describedby; Esc or a
 * tap elsewhere closes it.
 */
export default function Tooltip({ content, className, label = "More information" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="rounded text-faint transition-colors duration-150 hover:text-fg"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="dialog absolute bottom-full left-1/2 z-50 mb-2 block w-64 -translate-x-1/2 p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-fg-2"
        >
          {content}
        </span>
      )}
    </span>
  );
}
