import { ImageResponse } from "next/og";
import { buildPresetConfig, getPreset } from "@/lib/presets";
import { computeFarmReport } from "@/lib/farmReport";
import { FALLBACK_MARKET } from "@/lib/networkData";
import { formatHashRate, formatPower, formatUsd } from "@/lib/utils";

export const alt = "MineForge · Bitcoin Mining Farm Calculator: a live farm schematic with power, cooling, CAPEX and monthly profit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Control Room palette (dark graphite, orange reserved for market data)
const BG = "#0c0e10";
const FG = "#e4e7ea";
const MUTED = "#8e97a0";
const LINE = "#2a3038";
const BTC = "#f7931a";
const HEAT = "#f0a33c";
const COOL = "#5aa9f0";
const GOOD = "#4fc98a";

export default function OgImage() {
  // Real numbers: the Small Farm preset through the engine at the dated snapshot
  const config = buildPresetConfig(getPreset("small-farm"));
  const report = computeFarmReport(config, FALLBACK_MARKET);
  const figures = [
    ["HASHRATE", formatHashRate(report.totalHashRateThs)],
    ["POWER", formatPower(report.totalPowerKw)],
    ["CAPEX", formatUsd(report.metrics.totalCapex)],
    ["PROFIT / MONTH", `+${formatUsd(report.revenue.monthlyProfitUsd)}`],
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          color: FG,
          padding: "56px 64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: MUTED }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: BTC }} />
          <span style={{ color: FG, fontWeight: 700 }}>MineForge</span>
          <span>· Bitcoin Mining Farm Calculator</span>
        </div>

        <div style={{ display: "flex", fontSize: 58, fontWeight: 700, lineHeight: 1.08, marginTop: 28, maxWidth: 900, letterSpacing: -1 }}>
          Plan a mining farm down to the transformer and the last fan.
        </div>

        {/* Schematic snapshot: grid → transformer → container → fans */}
        <svg width="1072" height="170" viewBox="0 0 1072 170" style={{ marginTop: 26 }}>
          <path d="M40 140 L56 40 L72 140 M46 105 H66 M50 80 H62" stroke={FG} strokeWidth="3" fill="none" />
          <path d="M80 90 H210 M300 90 H420 M640 90 H760" stroke={BTC} strokeWidth="4" strokeDasharray="6 12" />
          <rect x="210" y="50" width="90" height="80" rx="6" fill={BG} stroke={FG} strokeWidth="2.5" />
          <circle cx="242" cy="90" r="18" fill="none" stroke={FG} strokeWidth="2.5" />
          <circle cx="268" cy="90" r="18" fill="none" stroke={FG} strokeWidth="2.5" />
          <rect x="420" y="30" width="220" height="120" rx="6" fill={BG} stroke={FG} strokeWidth="2.5" />
          <rect x="428" y="102" width="204" height="40" rx="3" fill={HEAT} fillOpacity="0.8" />
          <circle cx="800" cy="90" r="30" fill="none" stroke={COOL} strokeWidth="2.5" />
          <circle cx="880" cy="90" r="30" fill="none" stroke={COOL} strokeWidth="2.5" />
          <path d="M800 90 l0 -22 M800 90 l19 11 M800 90 l-19 11 M880 90 l0 -22 M880 90 l19 11 M880 90 l-19 11" stroke={COOL} strokeWidth="2.5" />
          <path d="M790 50 C 780 30, 806 20, 794 0 M870 50 C 860 30, 886 20, 874 0" stroke={HEAT} strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>

        <div style={{ display: "flex", marginTop: "auto", borderTop: `1px solid ${LINE}`, paddingTop: 24 }}>
          {figures.map(([label, value], i) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", flex: 1, paddingLeft: i ? 28 : 0, borderLeft: i ? `1px solid ${LINE}` : "none" }}>
              <span style={{ fontSize: 18, color: MUTED, letterSpacing: 2 }}>{label}</span>
              <span style={{ fontSize: 40, fontWeight: 600, color: i === 3 ? GOOD : FG, marginTop: 6 }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 18, color: MUTED, marginTop: 14 }}>
          Small Farm preset: 100 × Antminer S21 XP at $0.05/kWh · free · no account · open API
        </div>
      </div>
    ),
    { ...size },
  );
}
