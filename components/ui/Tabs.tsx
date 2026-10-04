"use client";

import { KeyboardEvent, useRef } from "react";
import { m } from "motion/react";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Prefix for tab/panel ids: tab `${idPrefix}-tab-${id}`, panel `${idPrefix}-panel-${id}` */
  idPrefix: string;
  label: string;
  className?: string;
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/**
 * WAI-ARIA tabs with roving tabindex: ←/→ move between tabs, Home/End jump to the
 * ends, and focus activates (automatic activation). The active indicator slides
 * with a shared layout animation.
 */
export default function Tabs<T extends string>({ tabs, value, onChange, idPrefix, label, className }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = tabs.findIndex((t) => t.id === value);
    const next =
      e.key === "ArrowRight" ? (i + 1) % tabs.length
      : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
      : e.key === "Home" ? 0
      : e.key === "End" ? tabs.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]", className)}
    >
      {tabs.map((tab, i) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={tabId(idPrefix, tab.id)}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative whitespace-nowrap px-3 pb-2.5 pt-2 text-sm font-medium transition-colors duration-150",
              selected ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {tab.label}
            {selected && (
              <m.span
                layoutId={`${idPrefix}-indicator`}
                className="absolute inset-x-2 -bottom-px h-0.5 bg-fg"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
