"use client";

import { useState, useEffect } from "react";
import { Activity, Clock } from "lucide-react";
import { useNetworkStore } from "@/lib/networkStore";
import { formatUsd, formatNumber } from "@/lib/utils";

function formatEh(eh: number): string {
  return `${eh.toFixed(1)} EH/s`;
}

function formatDifficulty(d: number): string {
  if (d >= 1e12) return `${(d / 1e12).toFixed(2)}T`;
  if (d >= 1e9) return `${(d / 1e9).toFixed(2)}G`;
  return formatNumber(d);
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function NetworkStatsBanner() {
  const { data, fetch: fetchData } = useNetworkStore();
  const [agoText, setAgoText] = useState("");

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update "time ago" text every 30 seconds
  useEffect(() => {
    if (!data) return;
    setAgoText(timeAgo(data.lastUpdated));
    const interval = setInterval(() => {
      setAgoText(timeAgo(data.lastUpdated));
    }, 30_000);
    return () => clearInterval(interval);
  }, [data]);

  if (!data) {
    return (
      <div className="glass-banner text-slate-400 text-xs py-1.5">
        <div className="container mx-auto px-4 flex items-center gap-2">
          <Activity className="h-3 w-3 animate-pulse" />
          <span>Loading network data...</span>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "BTC", value: formatUsd(data.btcPriceUsd), highlight: true },
    { label: "Hashrate", value: formatEh(data.networkHashrateEh) },
    { label: "Difficulty", value: formatDifficulty(data.difficulty) },
    { label: "Reward", value: `${data.blockReward} BTC` },
    { label: "Hashprice", value: `$${data.hashpriceUsdPhDay.toFixed(2)}/PH/day` },
  ];

  return (
    <div className="glass-banner text-xs py-1.5">
      <div className="container mx-auto px-4 flex items-center gap-1 flex-wrap">
        <Activity className={`h-3 w-3 mr-1 ${data.isLive ? "text-emerald-400" : "text-amber-400"}`} />
        {stats.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1 mr-3">
            <span className="text-slate-500">{s.label}</span>
            <span className={`font-mono tabular-nums ${s.highlight ? "text-amber-400 font-semibold" : "text-slate-300"}`}>
              {s.value}
            </span>
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 text-slate-500">
          <Clock className="h-3 w-3" />
          {data.isLive ? agoText : "offline — using estimates"}
        </span>
      </div>
    </div>
  );
}
