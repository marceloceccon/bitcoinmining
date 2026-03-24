"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Save, Copy, Check } from "lucide-react";
import Button from "./ui/Button";
import { useFarmStore } from "@/lib/store";
import { generateFarmId, createShareLink } from "@/lib/crypto";
import { saveFarm } from "@/lib/supabase";
import { checkSaveRateLimit, recordSave } from "@/lib/rateLimit";
import { useToast } from "./ui/Toast";

export default function SaveLoadPanel() {
  const config = useFarmStore((state) => state.config);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleSave = async () => {
    if (config.miners.length === 0) {
      alert("Add some miners first!");
      return;
    }

    const { allowed } = checkSaveRateLimit();
    if (!allowed) {
      showToast("Rate limit reached — please wait before saving again");
      return;
    }

    setSaving(true);
    try {
      const farmId = generateFarmId();
      await saveFarm(farmId, JSON.stringify(config));
      recordSave();
      setLink(createShareLink(farmId));
      setSaved(true);
    } catch (error) {
      console.error("Failed to save farm:", error);
      alert("Failed to save farm. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="primary"
        size="sm"
        onClick={handleSave}
        disabled={saving || config.miners.length === 0}
      >
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Saving..." : saved ? "Saved!" : "Save Farm"}
      </Button>

      {saved && link && createPortal(
        <div className="fixed inset-0 glass-modal-overlay flex items-center justify-center z-[60] p-4">
          <div className="glass-modal p-7 max-w-2xl w-full animate-fade-in-scale">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Farm Saved
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Share Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={link}
                    readOnly
                    className="flex-1 bg-white/40 border border-slate-200/60 rounded-xl px-3 py-2 text-sm font-mono text-slate-700"
                  />
                  <Button
                    variant={copied ? "primary" : "default"}
                    size="sm"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Anyone with this link can view your farm configuration
                </p>
              </div>

              <div className="p-4 glass-info rounded-2xl">
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-blueprint-deep">
                    How it works
                  </p>
                  <p className="text-slate-600">
                    Your farm config is stored as a snapshot — each save creates a new link
                  </p>
                  <p className="text-slate-600">
                    Bookmark this link to access your farm later
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="primary"
                onClick={() => {
                  setSaved(false);
                  setLink(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
