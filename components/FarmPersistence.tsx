"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import Button from "./ui/Button";
import { useFarmStore } from "@/lib/store";
import { useForecastStore } from "@/lib/forecastStore";
import { decodeShare, encodeShare } from "@/lib/share";

/**
 * Restores the farm after mount (so the server and first client render agree):
 * a ?s= share link wins over the farm saved in this browser. Also renders the
 * "Copy share link" control.
 */
export default function FarmPersistence() {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const [manualUrl, setManualUrl] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const shared = url.searchParams.get("s");
    (async () => {
      const state = shared ? await decodeShare(shared) : null;
      if (state) {
        useFarmStore.getState().loadConfig(state.config);
        if (state.params) useForecastStore.getState().load(state.params, state.growthOverride ?? null);
        url.searchParams.delete("s");
        window.history.replaceState(null, "", url);
      } else {
        await useFarmStore.persist.rehydrate();
        await useForecastStore.persist.rehydrate();
      }
    })();
  }, []);

  async function copyLink() {
    const { config } = useFarmStore.getState();
    const { params, growthOverride } = useForecastStore.getState();
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("s", await encodeShare({ config, params, growthOverride }));
    try {
      await navigator.clipboard.writeText(url.toString());
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setManualUrl(url.toString());
      setStatus("manual");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={copyLink}>
        <Link2 className="h-3.5 w-3.5" aria-hidden />
        Copy share link
      </Button>
      <span role="status" className="text-xs text-muted">
        {status === "copied" && "Link copied"}
      </span>
      {status === "manual" && (
        <input
          aria-label="Share link"
          readOnly
          value={manualUrl}
          onFocus={(e) => e.currentTarget.select()}
          autoFocus
          className="h-8 w-64 rounded border border-line bg-surface px-2 font-mono text-xs text-fg"
        />
      )}
    </div>
  );
}
