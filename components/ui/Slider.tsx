"use client";

import { InputHTMLAttributes, useId } from "react";
import { cn } from "@/lib/utils";
import Tooltip from "./Tooltip";

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  unit?: string;
  showValue?: boolean;
  tooltip?: React.ReactNode;
}

/**
 * Range input with a programmatic label, a visible value with units, and the
 * same value announced to screen readers (aria-valuetext). Arrow keys, Page
 * Up/Down and Home/End work natively.
 */
export default function Slider({ className, label, unit = "", showValue = true, tooltip, value, id, ...props }: SliderProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <label htmlFor={inputId} className="text-sm font-medium text-fg-2">
              {label}
            </label>
            {tooltip && <Tooltip content={tooltip} label={`About ${label.toLowerCase()}`} />}
          </div>
          {showValue && (
            <output htmlFor={inputId} className="font-mono text-sm text-fg">
              {value}
              {unit}
            </output>
          )}
        </div>
      )}
      <input
        id={inputId}
        type="range"
        value={value}
        aria-valuetext={value !== undefined ? `${value}${unit}` : undefined}
        aria-label={label ? undefined : props["aria-label"]}
        className={cn(
          "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-fg",
          "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-fg",
          className,
        )}
        {...props}
      />
    </div>
  );
}
