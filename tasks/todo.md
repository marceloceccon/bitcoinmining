# MineForge — Task Backlog

## Done ✅

- [x] **MVP calculator** — hash rate, power, CAPEX, OPEX, forecasting
- [x] **Supabase miner database** — fallback to local data
- [x] **Crypto save/load** — NaCl encryption, public-key sharing
- [x] **Mining Pool Parameters card** — payout scheme selector (PPS/PPLNS/FPPS/PPS+), pool fee slider, auto-default fees per scheme
- [x] **Reusable Tooltip component** — `components/ui/Tooltip.tsx`, `HelpCircle` icon, hover/focus accessible
- [x] **Tooltips on every parameter** — Regional Settings, Solar Power, Mining Pool, Forecast Parameters
- [x] **Deployment & Labor Costs tab** — `LaborConfig` type, Zustand store, calculations, `LaborCosts.tsx` component, 4th nav tab "⚒️ Deploy & Labor", "Advanced Labor →" shortcut in Build tab
- [x] **Labor in CAPEX** — `laborCost` + `cablesAndBreakers` flow into `totalCapex` via `calculateLaborCapex()`
- [x] **MetricsDashboard updated** — shows Deployment Labor + Cables & Breakers line items
- [x] **Forecasting totalCapex fix** — was hardcoded `0`; now uses `calculateFarmMetrics(config).totalCapex` so ROI, payback, and maintenance OPEX are accurate
- [x] **Air Cooling Fans section** — `air_fans` Supabase table (3 JMD models); model dropdown + qty auto-suggest (⌈required_m³h ÷ model_m³h⌉); supplied vs required airflow comparison (green/red); total power draw, noise, man-hours, CAPEX; airFanCapex + airFanPowerKw in FarmMetrics + totalCapex; MetricsDashboard line item
- [x] **Temperature Control tab** — 🌡️ tab after Deploy & Labor; react-leaflet world map modal → click land → Nominatim reverse-geocode city + Open-Meteo ERA5 climate data (avg/max/min °C with °F live conversion, avg humidity); air-cooled farms show ventilation m³/h & CFM with formula tooltip; hydro farms show dry cooler selector with 26 models (D1/D4 series), auto-qty from heat load, per-unit cost breakdown; dryCoolerCapex added to totalCapex + MetricsDashboard; Supabase `dry_coolers` table seeded with all 26 models
- [x] **Cyberpunk glassmorphism redesign** — full visual overhaul: fixed background image (`public/bg.jpg`) with gradient overlay, neon-pulse animated glass panels (`backdrop-blur-xl`, `bg-black/40`, `border-cyan/20`), hover glow + scale on cards, neon rim-lit nodes in farm visualization, scanline + vignette post-processing on ReactFlow schematic, cyberpunk Tailwind colors (`neon-cyan`, `neon-magenta`)
- [x] **Professional Forecast tab upgrade** — BTC Price Forecast line (S2F + pessimism, secondary Y-axis) on Revenue & Profit chart; Cash Flow chart (stacked area: CAPEX bar, OPEX, Revenue, sell-opex overlay, net cash flow line); IRR/NPV/Break-even BTC Price/Hashprice metric cards with discount rate slider; Monthly/Quarterly/Yearly toggle with expandable data table (8 columns); Key Drivers Impact sensitivity box (4 what-if scenarios); all cyberpunk-styled

---

## Recently Completed ✨

- [x] **Energy tab** — new ⚡ Energy tab houses Regional Settings (region selector, electricity price, tax adder) and Solar Power configuration (coverage, injection rate, installation cost, maintenance); split from old SolarPanel component; Mining Pool Parameters remains on Build tab
- [x] **Energy inflation** — `energyInflationPercent` added to `RegionalConfig` (default 3%); slider 0–15% in Energy tab; forecasting engine applies compound inflation to electricity costs per month
- [x] **Solar maintenance in OPEX** — `monthlySolarMaintenance` exposed as separate field in `FarmMetrics`; displayed as line item in Monthly OPEX card when solar is configured
- [x] **MetricsDashboard on all config tabs** — Live Metrics, Cost Breakdown, and Monthly OPEX now visible as sidebar on Build Farm, Energy, Deploy & Labor, and Thermal tabs (was previously only on Build)
- [x] **Tab renames** — Temperature → Thermal, Forecast → Projections, Visualize → Schematics
- [x] **Schematics cleanup** — removed top summary cards (hash rate, power, fans, CAPEX); tab now shows only the Farm Schematic + Legend

---

## Backlog 📋

- [ ] **Wire payout scheme into forecast** — different default fee per scheme already updates `poolFeePercent`; consider displaying scheme name in forecast summary
- [ ] **Global farm settings UI** — expose Parasitic Load %, Uptime %, Maintenance OPEX % as sliders in Build tab or Labor tab
- [ ] **Forecast: show CAPEX breakdown** — pie/donut chart of CAPEX components including labor
- [ ] **Forecast: pass ForecastParams as shareable URL params** — enable link sharing of forecast scenarios
- [ ] **FarmVisualization: show labor overlay** — annotate containers/racks with deployment hour estimates
- [ ] **Dark/light theme toggle**
- [ ] **Multi-currency support** — OPEX in local currency, revenue in USD
- [ ] **Cooling config UI** — expose air vs hydro selector and cost inputs in Build tab
- [ ] **Electrical config UI** — cable gauge, length, copper price inputs
