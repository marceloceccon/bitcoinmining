"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies `text`; falls back to selecting the snippet when the clipboard is unavailable. */
export default function CopyButton({ text, targetId }: { text: string; targetId: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.getElementById(targetId);
      if (el) window.getSelection()?.selectAllChildren(el);
    }
  }
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-fg" aria-label="Copy snippet">
      {copied ? <Check className="h-3.5 w-3.5 text-good" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
