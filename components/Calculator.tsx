"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronUp } from "lucide-react";
import { useFarmStore } from "@/lib/store";
import { useCalculation } from "@/lib/apiClient";
import { useUiStore } from "@/lib/uiStore";
import { formatHashRate, formatPower, formatUsd } from "@/lib/utils";
import FarmSchematic from "@/components/FarmSchematic";
import Metric from "@/components/ui/Metric";
import Tabs, { panelId, tabId, type TabItem } from "@/components/ui/Tabs";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import MinerSelector from "@/components/MinerSelector";
import FarmBuilder from "@/components/FarmBuilder";
import MetricsDashboard from "@/components/MetricsDashboard";
import MiningPoolParams from "@/components/MiningPoolParams";
import EnergyTab from "@/components/EnergyTab";
import LaborCosts from "@/components/LaborCosts";
import TemperatureControl from "@/components/TemperatureControl";
import ForecastCharts from "@/components/ForecastCharts";
import ImportTaxes from "@/components/ImportTaxes";
import FarmWarnings from "@/components/FarmWarnings";
import FarmPresets from "@/components/FarmPresets";

type Tab = "build" | "energy" | "labor" | "temperature" | "forecast";

const TABS: TabItem<Tab>[] = [
  { id: "build", label: "Build" },
  { id: "energy", label: "Energy" },
  { id: "labor", label: "Deploy & Labor" },
  { id: "temperature", label: "Thermal" },
  { id: "forecast", label: "Projections" },
];
const TAB_IDS = TABS.map((t) => t.id);
const ID_PREFIX = "workbench";

/** The active tab mirrors ?tab= so every tab has a shareable deep link. */
function useTabParam(): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>("build");
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (fromUrl && TAB_IDS.includes(fromUrl)) setTab(fromUrl);
  }, []);
  const change = useCallback((next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "build") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }, []);
  return [tab, change];
}

export default function Calculator() {
  const config = useFarmStore((s) => s.config);
  const { data: report } = useCalculation(config);
  const [tab, setTab] = useTabParam();
  const [sheetOpen, setSheetOpen] = useState(false);
  const requestMap = useUiStore((s) => s.requestMap);

  const goToTab = (next: Tab) => {
    setTab(next);
    document.getElementById("calculator")?.scrollIntoView({ block: "start" });
  };

  const profit = report?.revenue.monthlyProfitUsd ?? 0;
  const signedUsd = (v: number) => `${v >= 0 ? "+" : "−"}${formatUsd(Math.abs(v))}`;

  return (
    <>
      {/* Hero: what the tool does, and the live schematic of the current farm */}
      <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-6 pt-8 lg:grid-cols-[5fr_7fr] lg:pt-12">
        <div>
          <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-4xl">
            Plan a Bitcoin mining farm down to the transformer and the last fan.
          </h1>
          <p className="mt-3 max-w-xl text-fg-2">
            Pick a site and your hardware. MineForge sizes power, cooling at your climate and CAPEX, then forecasts cash
            flow from live network data. Free, no account, and the same engine is available as an API.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => goToTab("build")}>
              Start from a preset
            </Button>
            <Button
              onClick={() => {
                requestMap();
                goToTab("temperature");
              }}
            >
              Drop a pin on the map
            </Button>
          </div>
        </div>
        <div className="panel p-3">
          <div className="flex justify-between px-1 pb-1">
            <span className="label">Live farm schematic</span>
            {report && (
              <span className="label">
                {formatPower(report.totalPowerKw)} · {formatHashRate(report.totalHashRateThs)}
              </span>
            )}
          </div>
          <FarmSchematic config={config} report={report} />
        </div>
      </section>

      {/* Headline figures */}
      <section aria-label="Farm summary" className="border-y border-line bg-surface/60">
        <div className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
          {[
            <Metric key="h" label="Hashrate" value={report?.totalHashRateThs ?? 0} format={(v) => formatHashRate(v)} hint={`${config.miners.reduce((n, m) => n + m.quantity, 0)} miners`} />,
            <Metric key="p" label="Power" value={report?.totalPowerKw ?? 0} format={(v) => formatPower(v)} better="down" hint={report ? `${Math.round(report.metrics.transformerKva)} kVA required` : undefined} />,
            <Metric key="c" label="CAPEX" value={report?.metrics.totalCapex ?? 0} format={(v) => formatUsd(v)} better="down" hint={report ? `miners ${Math.round((report.metrics.minerCost / Math.max(1, report.metrics.totalCapex)) * 100)}%` : undefined} />,
            <Metric key="m" label="Monthly profit" value={profit} format={signedUsd} better="up" hint={report ? `revenue ${formatUsd(report.revenue.monthlyRevenueUsd)} · OPEX ${formatUsd(report.revenue.monthlyOpexUsd)}` : undefined} />,
          ].map((metric, i) => (
            <div key={i} className="border-line px-4 py-4 [&:nth-child(odd)]:border-r lg:border-r lg:last:border-r-0">
              {metric}
            </div>
          ))}
        </div>
      </section>

      {/* Workbench: tabs on top, sticky results on the right (desktop) */}
      <section id="calculator" className="mx-auto max-w-7xl scroll-mt-16 px-4 pb-24 pt-6 lg:pb-8">
        <Tabs tabs={TABS} value={tab} onChange={setTab} idPrefix={ID_PREFIX} label="Calculator sections" className="mb-6" />
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={tab}
            id={panelId(ID_PREFIX, tab)}
            role="tabpanel"
            aria-labelledby={tabId(ID_PREFIX, tab)}
            tabIndex={0}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="outline-none"
          >
            {tab === "forecast" ? (
              <ForecastCharts />
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="min-w-0 space-y-6 lg:col-span-2">
                  {tab === "build" && (
                    <>
                      <FarmWarnings />
                      <FarmPresets />
                      <MinerSelector />
                      <FarmBuilder />
                      <ImportTaxes />
                      <MiningPoolParams />
                    </>
                  )}
                  {tab === "energy" && <EnergyTab />}
                  {tab === "labor" && <LaborCosts />}
                  {tab === "temperature" && <TemperatureControl />}
                </div>
                <aside className="hidden min-w-0 lg:block" aria-label="Results">
                  <div className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-6 overflow-y-auto pb-2">
                    <MetricsDashboard />
                  </div>
                </aside>
              </div>
            )}
          </m.div>
        </AnimatePresence>
      </section>

      {/* Mobile: results collapse into a sticky summary bar that opens as a sheet */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="grid w-full grid-cols-[repeat(4,minmax(0,1fr))_auto] items-center gap-2 px-3 py-2 text-left"
          aria-label="Show full results"
        >
          {[
            ["Hash", report ? formatHashRate(report.totalHashRateThs) : "—"],
            ["Power", report ? formatPower(report.totalPowerKw) : "—"],
            ["CAPEX", report ? formatUsd(report.metrics.totalCapex) : "—"],
            ["Profit/mo", report ? signedUsd(profit) : "—"],
          ].map(([k, v]) => (
            <span key={k} className="min-w-0">
              <span className="label block">{k}</span>
              <span className={`block truncate font-mono text-sm ${k === "Profit/mo" ? (profit >= 0 ? "text-good" : "text-bad") : "text-fg"}`}>{v}</span>
            </span>
          ))}
          <ChevronUp className="h-4 w-4 text-muted" aria-hidden />
        </button>
      </div>
      <Dialog open={sheetOpen} onClose={() => setSheetOpen(false)} title="Results" placement="bottom">
        <div className="space-y-6 p-4">
          <MetricsDashboard />
        </div>
      </Dialog>
    </>
  );
}
