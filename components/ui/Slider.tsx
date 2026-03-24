"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes } from "react";
import Tooltip from "./Tooltip";

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  unit?: string;
  showValue?: boolean;
  tooltip?: React.ReactNode;
}

export default function Slider({
  className,
  label,
  unit,
  showValue = true,
  tooltip,
  value,
  ...props
}: SliderProps) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <label className="text-sm font-medium text-slate-700">{label}</label>
            {tooltip && <Tooltip content={tooltip} />}
          </div>
          {showValue && (
            <span className="text-sm font-mono text-slate-500 tabular-nums">
              {value}{unit}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        value={value}
        className={cn(
          "w-full h-2 bg-slate-200/60 rounded-full appearance-none cursor-pointer",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blueprint-deep",
          "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md",
          "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white",
          "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150",
          "[&::-webkit-slider-thumb]:hover:scale-110",
          "[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:bg-blueprint-deep [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white",
          "[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md",
          className
        )}
        {...props}
      />
    </div>
  );
}
