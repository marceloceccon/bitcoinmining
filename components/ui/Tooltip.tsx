"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  className?: string;
}

export default function Tooltip({ content, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <button
        type="button"
        className="text-slate-400 hover:text-blueprint-deep focus:outline-none focus-visible:ring-1 focus-visible:ring-blueprint-deep/30 rounded transition-colors duration-150"
        aria-label="More information"
        tabIndex={0}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 p-3 text-xs text-slate-700 glass-modal pointer-events-none animate-fade-in-scale">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white/80" />
        </div>
      )}
    </span>
  );
}
