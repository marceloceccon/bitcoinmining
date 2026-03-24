"use client";

import { useState } from "react";
import Image from "next/image";
import MinerSelector from "@/components/MinerSelector";
import FarmBuilder from "@/components/FarmBuilder";
import MetricsDashboard from "@/components/MetricsDashboard";
import SolarPanel from "@/components/SolarPanel";
import EnergyTab from "@/components/EnergyTab";
import LaborCosts from "@/components/LaborCosts";
import TemperatureControl from "@/components/TemperatureControl";
import ForecastCharts from "@/components/ForecastCharts";
import ImportTaxes from "@/components/ImportTaxes";
import SaveLoadPanel from "@/components/SaveLoadPanel";
import NetworkStatsBanner from "@/components/NetworkStatsBanner";
import FarmWarnings from "@/components/FarmWarnings";
import FarmPresets from "@/components/FarmPresets";

type Tab = "build" | "energy" | "labor" | "temperature" | "forecast" | "about";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("build");

  const showMetrics = activeTab === "build" || activeTab === "labor" || activeTab === "temperature";

  return (
    <div className="min-h-screen glass-body-bg">
      {/* Live Network Stats */}
      <NetworkStatsBanner />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-header">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/web-app-manifest-512x512.png"
                alt="Bitcoin Mining Farm Calculator"
                width={36}
                height={36}
                className="rounded-xl shadow-sm"
              />
              <div>
                <span className="text-lg font-bold text-slate-900 tracking-tight">Bitcoin Mining Farm Calculator</span>
                <p className="text-xs text-slate-500">Free CAPEX &amp; ROI Tool</p>
              </div>
            </div>
            <SaveLoadPanel />
          </div>
        </div>
      </header>

      {/* SEO Hero */}
      <section className="container mx-auto px-4 pt-8 pb-2">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
          Bitcoin Mining Farm Calculator
        </h1>
        <p className="mt-2 text-slate-500 max-w-3xl text-sm leading-relaxed">
          Plan your entire Bitcoin mining operation — from a single ASIC to a 10,000-unit industrial farm.
          Model hardware procurement, import duties, deployment labor, electrical infrastructure, cooling
          systems, solar offset, pool fees, and multi-year revenue forecasts. No account. No tracking.
          Runs entirely in your browser.
        </p>
        <Image
          src="/screenshot.png"
          alt="Bitcoin Mining Farm Calculator dashboard showing full CAPEX, OPEX and ROI projections"
          width={2}
          height={2}
          className="w-full max-w-[2px] rounded-lg shadow-md mx-auto mt-5"
          priority
        />
      </section>

      {/* Navigation */}
      <nav id="calculator" className="container mx-auto px-4 py-4">
        <div className="glass-nav p-1.5 inline-flex gap-1 flex-wrap">
          {(
            [
              { id: "build", label: "Build Farm", icon: "01" },
              { id: "energy", label: "Energy", icon: "02" },
              { id: "labor", label: "Deploy & Labor", icon: "03" },
              { id: "temperature", label: "Thermal", icon: "04" },
              { id: "forecast", label: "Projections", icon: "05" },
              { id: "about", label: "About", icon: "06" },
            ] as { id: Tab; label: string; icon: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
                activeTab === tab.id
                  ? "bg-blueprint-deep text-white shadow-md"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <span className="mr-2 text-xs font-mono opacity-60">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div key={activeTab} className="animate-fade-in">
        {activeTab === "build" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <FarmWarnings />
              <FarmPresets />
              <MinerSelector />
              <FarmBuilder />
              <ImportTaxes />
              <SolarPanel />
            </div>
            <div className="space-y-6">
              <MetricsDashboard />
            </div>
          </div>
        )}

        {activeTab === "energy" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <EnergyTab />
            </div>
            <div className="space-y-6">
              <MetricsDashboard />
            </div>
          </div>
        )}

        {activeTab === "labor" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <LaborCosts />
            </div>
            <div className="space-y-6">
              <MetricsDashboard />
            </div>
          </div>
        )}

        {activeTab === "temperature" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TemperatureControl />
            </div>
            <div className="space-y-6">
              <MetricsDashboard />
            </div>
          </div>
        )}

        {activeTab === "forecast" && (
          <div>
            <ForecastCharts />
          </div>
        )}

        {activeTab === "about" && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* What is this */}
            <div className="glass-card p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">About Bitcoin Mining Farm Calculator</h2>
              <p className="text-slate-600 leading-relaxed">
                Bitcoin Mining Farm Calculator is a free, browser-based tool to help you build rough estimates for a Bitcoin mining operation — from a single ASIC to an industrial farm. It models hardware costs, deployment labor, electrical infrastructure, solar offset, cooling, and multi-year revenue forecasts based on the Stock-to-Flow model.
              </p>
              <p className="text-slate-600 leading-relaxed mt-3">
                Built by Marcelo Ceccon. Independent tool for miners &amp; investors.
              </p>
            </div>

            {/* Disclaimer */}
            <div className="glass-card glass-warning p-8">
              <h3 className="text-lg font-semibold text-amber-700 mb-3">Disclaimer</h3>
              <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                <p>
                  This tool is provided <strong className="text-slate-900">as-is</strong>, for informational and educational purposes only. All figures are rough estimates and should not be treated as financial, investment, or engineering advice.
                </p>
                <p>
                  Miner prices, hardware availability, Bitcoin price, network difficulty, and electricity costs change constantly. No warranty of accuracy is made — always verify numbers with real quotes from suppliers and licensed electricians before committing capital.
                </p>
                <p>
                  The miner database and hardware prices may or may not be updated in the future. This project may or may not receive ongoing maintenance. Use it as a starting point, not a source of truth.
                </p>
              </div>
            </div>

            {/* Open source */}
            <div className="glass-card p-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Open Source</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Once the project reaches a stable state, it will be open-sourced so that anyone can contribute, fork it, maintain the miner database, or host their own instance. The goal is for the community to keep it alive and accurate even if the original maintainer moves on.
              </p>
            </div>

            {/* Privacy */}
            <div className="glass-card p-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Privacy</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                No accounts. Your farm configuration lives entirely in your browser. The optional save feature stores a snapshot — anyone with the link can view it, but links use unguessable IDs. No tracking, no cookies.
              </p>
            </div>

            <div className="text-center py-4">
              <p className="text-blueprint-deep font-semibold">Long Bitcoin, Short the Bankers</p>
            </div>
          </div>
        )}
        </div>
      </main>

      {/* About section */}
      <section id="about-footer" className="container mx-auto px-4 py-8 mt-10 text-center glass-card max-w-2xl">
        <h2 className="text-xl font-bold text-slate-900 mb-2">About</h2>
        <p className="text-sm text-slate-600">Built by Marcelo Ceccon. Independent tool for miners &amp; investors.</p>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-6 mt-10 border-t border-slate-200/50">
        <div className="text-center text-slate-500 text-sm">
          <p>&copy; 2026 Bitcoin Mining Farm Calculator &middot; Simulation tool only &middot; No real mining or financial advice</p>
          <p className="mt-1">Built by Marcelo Ceccon. Independent tool for miners &amp; investors.</p>
          <p className="mt-3 font-mono text-xs text-slate-300">
            {process.env.NEXT_PUBLIC_COMMIT_HASH ?? 'dev'} &middot; {process.env.NEXT_PUBLIC_COMMIT_DATE ?? ''}
          </p>
        </div>
      </footer>
    </div>
  );
}
