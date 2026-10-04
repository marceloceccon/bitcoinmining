"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme";

type ThemeChoice = "system" | "light" | "dark";

const OPTIONS: { id: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { id: "system", label: "Match system theme", icon: Monitor },
  { id: "light", label: "Light theme (blueprint paper)", icon: Sun },
  { id: "dark", label: "Dark theme (graphite)", icon: Moon },
];

export default function ThemeToggle({ className }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === "light" || t === "dark") setChoice(t);
  }, []);

  function apply(next: ThemeChoice) {
    setChoice(next);
    const root = document.documentElement;
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): the choice lasts for this page view.
    }
  }

  return (
    <div role="group" aria-label="Theme" className={cn("inline-flex rounded border border-line p-0.5", className)}>
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          aria-pressed={choice === id}
          title={label}
          onClick={() => apply(id)}
          className={cn(
            "rounded-sm p-1.5 text-muted transition-colors duration-150 hover:text-fg",
            choice === id && "bg-surface-2 text-fg",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
