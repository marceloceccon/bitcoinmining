# Bitcoin Mining Farm Calculator — Calculation Architecture

This document describes every formula, assumption, and limitation in the calculation engine. It is intended for developers integrating with the API, auditors verifying the math, and operators who need to understand what the numbers mean before committing capital.

The engine has two layers: **CAPEX/OPEX metrics** (instantaneous farm economics) and **multi-year forecasting** (time-series revenue projection). Both are pure functions. **Market state is an input, never a constant**: the forecast is `generateForecast(config, params, market, now)`, and the same `(config, params, market, now)` always produces the same output. The UI, the REST API and the tests all run this same engine.

---

## Table of Contents

1. [Power & Energy](#1-power--energy)
2. [Electrical Infrastructure](#2-electrical-infrastructure)
3. [Physical Infrastructure](#3-physical-infrastructure)
4. [Cooling & Climate](#4-cooling--climate)
5. [Solar Offset](#5-solar-offset)
6. [Labor & Deployment](#6-labor--deployment)
7. [Import Taxes](#7-import-taxes)
8. [Total CAPEX](#8-total-capex)
9. [Monthly OPEX](#9-monthly-opex)
10. [Market Snapshot (Live Inputs)](#10-market-snapshot-live-inputs)
11. [Bitcoin Mining Revenue](#11-bitcoin-mining-revenue)
12. [BTC Price Scenarios (Choices, Not Predictions)](#12-btc-price-scenarios-choices-not-predictions)
13. [Multi-Year Forecast Engine](#13-multi-year-forecast-engine)
14. [Financial Metrics (NPV, IRR, Break-even)](#14-financial-metrics-npv-irr-break-even)
15. [Sensitivity Analysis](#15-sensitivity-analysis)
16. [Noise Modeling](#16-noise-modeling)
17. [Where Computation Happens & REST API](#17-where-computation-happens--rest-api)
18. [Rate Limiting](#18-rate-limiting)
19. [Assumptions Summary](#19-assumptions-summary)
20. [Known Limitations](#20-known-limitations)
21. [Accuracy Assessment](#21-accuracy-assessment)
22. [Verification](#22-verification)

---

## 1. Power & Energy

### Total Power Draw

```
P_total (kW) = [ SUM(miner_watts_i * quantity_i) * (1 + parasitic_load_% / 100) ] / 1000
```

- **Parasitic load** (default 5%) accounts for cooling fans, networking equipment, control systems, lighting, and miscellaneous facility loads that are not the miners themselves.
- The parasitic load is a `FarmConfig` field (`parasiticLoadPercent`). The UI currently has no control for it (it stays at the 5% default); REST callers can set any value.
- **Cooling fan draw is not added twice.** The power of the selected air fans (`airFanPowerKw`) and of dry cooler fans is *reported*, but it is considered covered by the parasitic load percentage and is not added to `P_total`.

### Monthly Energy

```
monthly_kWh = P_total (kW) * 730.5
```

- **730.5 hours/month** = `DAYS_PER_MONTH` (30.4375 = 365.25 / 12) × 24. Revenue uses the same 30.4375-day month (section 11), so energy cost and mining revenue always cover the same period.
- Uptime is NOT factored into energy consumption. The assumption is that miners draw power whether productive or not (fans run, PSUs idle). This is a conservative assumption — actual energy may be slightly lower during downtime.

### Heat Output

```
heat_BTU_per_hour = P_total (W) * 3.412
```

- The conversion factor 3.412 BTU/h per watt is an exact thermodynamic constant.
- All electrical energy consumed by ASIC miners converts to heat (no mechanical output). This is physically accurate.

**Assumptions:**
- Miner power consumption is taken at face value from manufacturer specs (nameplate rating). Real-world draw can vary +/-10% depending on firmware, voltage, and ambient temperature.
- Power factor is assumed to be ~1.0 (modern ASIC PSUs are typically 0.95–0.99 PF). The 20% transformer overhead partially compensates for this.

---

## 2. Electrical Infrastructure

### Current Draw

```
amps = P_total (W) / 220V
```

- **220V** is assumed as the standard industrial single-phase voltage. Three-phase installations would use 380–480V, reducing current. This is a simplification — the calculator does not model three-phase distribution, though the transformer table switches to three-phase models from 75 kVA.

### Transformer Sizing

```
kVA_required = P_total (kW) * 1.2
```

- The **20% overhead** accounts for power factor correction, inrush current during startup, and future expansion headroom. Industry practice ranges from 15–25%.
- Farms under **15 kVA** (roughly 4 miners) do not need a dedicated transformer — standard residential/commercial service suffices.
- Transformer selection (`lib/transformerData.ts`) picks the smallest of 15 models (15 kVA to 2,500 kVA; single-phase up to 50 kVA, three-phase from 75 kVA) that covers the load. For loads exceeding 2,500 kVA, multiple units of the largest transformer are used.

### Cable Cost

```
cable_weight_kg = (length_m / 100) * 4 * 2^((6 - AWG) / 3)
cable_cost = (cable_weight_kg * copper_price_per_kg) + (length_m * $15)
```

- AWG 6 baseline: ~4 kg per 100m of copper conductor.
- The gauge multiplier scales by cross-sectional area (each 3 AWG steps doubles the area).
- **$15/meter installation** is a flat rate covering trenching, conduit, pull, and termination.

**Limitations:**
- Does not model voltage drop over distance (important for runs >50m at high current).
- Does not differentiate between overhead and underground runs.
- Copper price is user-adjustable but defaults to $9.50/kg.

### Breaker Panel Sizing

Computed in the dashboard's Electrical Panel card (`components/MetricsDashboard.tsx`), not in `lib/`:

```
main_breaker = total_amps / 0.8      (NEC 80% continuous load rule), rounded up to
               20/30/40/50/60/100/200 A, or to the next 100 A above that
branch_circuits = ceil(total_amps / 24)  (30A breakers at 80% = 24A usable)
panel_slots = ceil(circuits / 2) * 2     (panels have even slot counts)
panels = ceil(panel_slots / 42)          (20-, 30- or 42-slot panel)
```

- Based on the US National Electrical Code (NEC) Article 210.20 for continuous loads.
- Assumes 220V, 30A branch breakers (standard for mining PDU connections).

---

## 3. Physical Infrastructure

### Steel Racks

```
rack_units = ceil(total_miners / 50)
rack_cost = rack_units * $700
```

- **50 miners per rack** is based on standard 42U open-frame server racks with 1.2U spacing per miner.
- **$700** is the cost of a heavy-duty industrial rack (not consumer-grade).

### Shipping Containers

```
containers = ceil(total_miners / 250)
container_cost = containers * $6,000
```

- **250 miners per 20ft container** accounts for rack space, airflow corridors, and electrical panel area.
- **$6,000** includes: bare 20ft ISO container, steel flooring reinforcement, spray foam insulation, basic electrical panel, ultra-white reflective exterior paint, and averaged domestic transport.
- Racks are still needed inside containers — container cost is additive to rack cost.

---

## 4. Cooling & Climate

All cooling sizing lives in one pure module, **`lib/cooling.ts`**, used by the engine, the store's auto-sizing, the Thermal tab and the REST API. It does no I/O; callers pass in the catalog rows to size from. The hardware catalogs (miners, dry coolers, air fans) come from `data/*.json` through `lib/catalog.ts`, the single source for the engine, the API and the UI.

### Climate Model

When a location is selected (via map pick with ERA5 climate data), the engine uses the site's `maxTempC` and `avgHumidityPercent` to adjust cooling calculations. When no location is set, a **temperate fallback** (`DEFAULT_CLIMATE`) is used:

| Parameter | Default Value | Rationale |
|---|---|---|
| Average yearly temp | 25°C | Mid-latitude temperate (US Mid-Atlantic) |
| Maximum temp | 35°C | Baseline rating for dry coolers |
| Minimum temp | 5°C | Not used in calculations currently |
| Average humidity | 60% | Below the 70% penalty threshold |

At these defaults, all cooling formulas produce identical results to a non-climate-aware model (dry cooler derating is exactly 1.0).

### Heat Load per Cooling Type

```
heat_kW(kind) = SUM(miner_watts_i * quantity_i  for miners of that cooling type)
              * (1 + parasitic_load_% / 100) / 1000
```

`coolingHeatLoadKw(config, 'air' | 'hydro')` splits a mixed farm: air-cooled miners are sized for ventilation fans and water-cooled miners for dry coolers, each carrying its share of the parasitic load. For a single-type farm this equals `P_total`. A hydro-only farm needs no ventilation airflow; an air-only farm needs no dry coolers.

### Air Cooling — Ventilation Requirement

Base thermodynamic formula (`requiredAirflowM3h`), applied to the air-cooled heat load:

```
Q (m^3/h) = P (W) / (rho * Cp * delta_T) * 3600

where:
  rho   = 1.2 kg/m^3   (air density at sea level, ~25°C)
  Cp    = 1005 J/kg*K   (specific heat of air)
  delta_T = effective temperature rise across miners
```

#### Climate adjustment — Temperature

The allowable temperature rise (delta_T) depends on how close ambient is to the miner's thermal limit (~50°C exhaust):

```
effective_delta_T = max(5, 50 - maxTempC)
```

| Max ambient | Effective delta_T | Airflow multiplier vs 35°C baseline |
|---|---|---|
| 25°C | 25°C | 0.6x (60% of baseline) |
| 30°C | 20°C | 0.75x |
| 35°C | 15°C | 1.0x (baseline) |
| 40°C | 10°C | 1.5x |
| 45°C | 5°C (minimum) | 3.0x |

#### Climate adjustment — Humidity

High humidity reduces the effectiveness of convective cooling by limiting evaporative heat transfer at equipment surfaces:

```
humidity_penalty = 1 + min((humidity% - 70) * 0.01, 0.15)
                         ^ only if humidity > 70%
```

This adds up to 15% more airflow for very humid environments (85%+ humidity).

#### Final airflow

```
airflow_m3h = base_Q * humidity_penalty
airflow_cfm = airflow_m3h * 0.5886
```

**Assumptions:**
- Air density at sea level. High-altitude installations have lower air density, requiring more airflow (not modeled).
- Miners are assumed to tolerate up to 50°C exhaust temperature. Some models throttle at 45°C.
- The humidity penalty is empirical (not derived from psychrometric models). It approximates the real effect for planning purposes.

### Hydro Cooling — Dry Cooler Derating

Dry coolers are rated at 35°C ambient. Performance changes with actual site temperature (`dryCoolerDeratingFactor`):

```
if maxTempC > 35:
  derating_factor = max(0.5, 1 - (maxTempC - 35) * 0.03)
else:
  derating_factor = min(1.3, 1 + (35 - maxTempC) * 0.02)
```

| Max ambient | Derating factor | Effect |
|---|---|---|
| 25°C | 1.20 (120%) | 20% extra capacity in cool climates |
| 30°C | 1.10 (110%) | |
| 35°C | 1.00 (100%) | Nameplate rating |
| 40°C | 0.85 (85%) | Need ~18% more units |
| 45°C | 0.70 (70%) | Need ~43% more units |
| 50°C | 0.55 (55%) | Near minimum — extreme desert |

The **3% per degree** derating above 35°C is a conservative industry average. Manufacturer datasheets typically show 2–4% depending on fin spacing and fan curves.

The **2% per degree** improvement below 35°C is intentionally less aggressive because manufacturers do not guarantee linear gains below rated conditions.

**Effective capacity:**

```
effective_kW = SUM(model_kW_rated * quantity * derating_factor)
```

This derated capacity is used for sizing warnings ("undersized" / "oversized").

### Auto-Sizing

`recommendCoolingSelections` sizes both systems at the site climate:

```
Hydro (sizeHydroCooling): model  = dry cooler whose 35°C rating is closest to heat_kW(hydro)
                          units  = max(1, ceil(heat_kW(hydro) / (rating_kW * derating_factor)))
Air   (sizeAirCooling):   model  = highest-airflow fan in the catalog
                          units  = max(1, ceil(airflow_m3h(heat_kW(air)) / fan_airflow_m3h))
```

Unit cost is hardware + deployment man-hours × hourly labor rate (+ plumbing and fluid for dry coolers); see `dryCoolerUnitCostUsd` / `airFanUnitCostUsd`.

**When the store re-sizes.** The UI store re-runs auto-sizing whenever the miners, the parasitic load or the site location change. A manual edit of the dry cooler or fan selections sets `coolingOverridden`: from then on, location and parasitic-load changes keep the user's quantities. Changing the miners or clicking **"Re-size automatically"** clears the override and re-sizes from scratch (loading a saved config or resetting also clears it).

---

## 5. Solar Offset

### Installed Capacity

```
solar_kW_installed = P_total (kW) * (coverage% / 100) * 2
```

The **2x multiplier** accounts for the day/night cycle: solar panels only generate during ~50% of the day, so 2x nameplate capacity is needed to offset a given percentage of 24/7 consumption on an annualized basis.

### Effective Coverage (Injection Rate)

```
effective_coverage% = coverage% * (injection_rate% / 100)
```

The **injection rate** models net metering policies. At 100% (default), all surplus solar energy exported to the grid is credited 1:1. Lower values represent "injection taxes" where the utility credits only a fraction of exported energy.

### Solar CAPEX

```
solar_capex = solar_kW_installed * cost_per_kW
```

Default: $1,200/kW. Commercial-scale solar installations typically range $800–$1,500/kW depending on location, ground conditions, and grid interconnection costs.

By default (`includeCommissioningInCapex: false`) solar is treated as a separate project: `solar_capex` is reported but **not** rolled into the farm's total CAPEX (section 8). Only its maintenance enters OPEX.

### Solar OPEX

```
monthly_solar_maintenance = (solar_capex * maintenance% / 100) / 12
```

Default: 1% of CAPEX per year. Covers panel cleaning, inverter servicing, vegetation management, and minor repairs.

**Limitations:**
- No seasonal generation curve — solar is treated as a flat annual average.
- No battery storage modeling.
- No degradation of solar panels over time (real panels lose ~0.5%/year).
- The 2x day/night factor is a rough global average. Equatorial sites need less, high-latitude sites need more.

---

## 6. Labor & Deployment

### Deployment CAPEX

```
labor_hours = (miners * hours_per_miner)
            + (needs_transformer ? hours_per_transformer : 0)
            + (rack_units * hours_per_rack)
            + (containers * hours_per_container)   [only if container setup]

labor_cost = labor_hours * hourly_rate
cables_and_breakers = miners * per_miner_cable_cost

deployment_capex = labor_cost + cables_and_breakers
```

**Defaults** (the UI's default farm config; REST callers send every field explicitly):

| Parameter | Default | Typical range |
|---|---|---|
| Hours per miner | 1 | Higher for first-time crews |
| Hours per transformer | 8 | 6–16 |
| Hours per rack | 4 | 2–6 |
| Hours per container | 80 | 24–60 |
| Hourly labor rate | $20 | Region-dependent |
| Cables & breaker per miner | $40 | Materials only |

### Maintenance Labor (OPEX)

```
if miners <= 20:
  monthly_hours = 8
else:
  monthly_hours = 30 + (miners * 0.2) + (air_fan_units * 1)

monthly_cost = monthly_hours * hourly_maintenance_rate     (default $35/h)
```

The step function at 20 miners models the transition from part-time oversight (hobby scale) to requiring a dedicated maintenance schedule (commercial scale).

---

## 7. Import Taxes

```
import_tax_capex = miner_cost * (miner_tax% / 100)
                 + rack_cost * (rack_tax% / 100)
                 + container_cost * (container_tax% / 100)
                 + air_fan_capex * (fan_tax% / 100)
                 + dry_cooler_capex * (dry_cooler_tax% / 100)
```

Default: **10%** on all categories. Each category is independently adjustable (0–100%) to model different tariff schedules by country and equipment classification.

**Limitation:** Does not model customs brokerage fees, freight insurance, or VAT/GST (which may be recoverable).

---

## 8. Total CAPEX

```
total_capex = miner_hardware_cost
            + transformer_cost
            + cable_cost
            + rack_cost
            + container_cost
            + cooling_cost            (legacy, currently $0)
            + solar_capex             (only when includeCommissioningInCapex)
            + deployment_labor
            + cables_and_breakers
            + dry_cooler_capex
            + air_fan_capex
            + import_tax_capex
```

Twelve line items. All are deterministic given the input configuration.

---

## 9. Monthly OPEX

`calculateMonthlyOpexBreakdown(config, totalCapex)` itemizes OPEX. The dashboard and the forecast both use it, so month 1 of a forecast (before energy inflation) equals the dashboard's `monthlyOpex`.

```
electricity_cost  = grid_kWh * price_per_kWh * (1 + tax_adder% / 100)
maintenance_cost  = (total_capex * maintenance_opex% / 100) / 12
solar_maintenance = (solar_capex * solar_maintenance% / 100) / 12
labor_maintenance = monthly_maintenance_hours * hourly_rate

monthly_opex = electricity_cost + maintenance_cost + solar_maintenance + labor_maintenance
```

Where:
```
grid_kWh = monthly_kWh * (1 - effective_solar_coverage / 100)      (monthly_kWh at 730.5 h)
```

In the forecast, **only electricity inflates** (section 13); maintenance, solar maintenance and maintenance labor stay flat.

**Note:** The `maintenance_cost` (default 5% of CAPEX/year) is a catch-all for equipment repairs, replacement parts, insurance, and facility overhead. It does NOT include electricity or labor, which are calculated separately.

### Worked example: Industrial preset (P1.9)

500 × S21 Hydro (5,360 W) at the defaults ($0.05/kWh, 5% parasitic, 5% maintenance, $35/h maintenance labor), checked in `tests/opex.test.ts`:

| Line item | Calculation | Monthly |
|---|---|---|
| Electricity | 500 × 5,360 W × 1.05 = 2,814 kW × 730.5 h × $0.05 | $102,781 |
| Maintenance | 5%/yr × $5,003,487 CAPEX / 12 | $20,848 |
| Maintenance labor | (30 + 0.2 × 500 + 0 fans) = 130 h × $35 | $4,550 |
| Solar maintenance | no solar | $0 |
| **Total** | | **$128,179** |

Every dollar is itemized; the "~$100k unexplained OPEX" reported against an older build does not exist in the current engine.

---

## 10. Market Snapshot (Live Inputs)

All market state enters the engine as one `MarketSnapshot` (`types/index.ts`), produced by `lib/networkData.ts` and passed to the UI, the REST API and the tests:

| Field | Live source (mempool.space unless noted) | Offline estimate (`FALLBACK_MARKET`) |
|---|---|---|
| `btcPriceUsd` | `/api/v1/prices` (USD); CoinGecko `simple/price` as backup | $84,714 |
| `networkHashrateEh` | `/api/v1/mining/hashrate/1m` → `currentHashrate` / 10¹⁸ | 964 EH/s |
| `blockHeight` | `/api/blocks/tip/height` | 969,763 |
| `blockReward` | Derived: `subsidyAtHeight(blockHeight)` = 50 / 2^floor(height / 210,000) | 3.125 BTC |
| `avgFeesPerBlockBtc` | `/api/v1/mining/reward-stats/144` → `totalFee` / block count / 10⁸ | 0.027 BTC |
| `asOf`, `isLive`, `sources` | Snapshot time, liveness flag, where each value came from | 2026-10-03, `false`, "offline estimate (2026-10-03 snapshot)" |

`/api/network` additionally serves derived display values: `difficulty` (from the hashrate endpoint, else implied as H/s × 600 / 2³²), `hashpriceUsdPhDay` (including fees, section 11), `nextHalving` (section 13) and `hashrateGrowth12mPercent` (section 13).

- **One dated fallback.** `FALLBACK_MARKET` (the 2026-10-03 snapshot) is the only hardcoded market data in the app. Each value falls back independently (5 s timeout per request), and fallback values are labelled **"offline estimate"** in the UI.
- **`isLive`** is `true` only when price, hashrate and tip height all came from a live source (live fees are not required). A snapshot with any REST `market` override is `isLive: false`, and its `sources` say "request override" for the pinned values.
- **Caching.** The server caches the snapshot for **60 s** and de-duplicates concurrent loads. The browser polls `GET /api/network` every 5 minutes through one shared poller; until the first response arrives it computes with `FALLBACK_MARKET`.

---

## 11. Bitcoin Mining Revenue

### Core Formula

One formula, in `lib/unitEconomics.ts`, is shared by the forecast engine, the dashboard, the farm warnings and `POST /api/calculate`:

```
share       = farm_hashrate_TH / 10^6 / network_hashrate_EH
daily_BTC   = share * 144 * (block_subsidy + fees_per_block)
            * (uptime% / 100) * (1 - pool_fee% / 100)
monthly_BTC = daily_BTC * 30.4375
revenue_usd = monthly_BTC * btc_price
```

In the forecast, `farm_hashrate_TH` is multiplied by the degradation factor, `block_subsidy` is the month's mean subsidy and `network_hashrate_EH` grows (section 13).

**Constants:**
- **144 blocks/day** — Bitcoin targets one block every 600 seconds (10 minutes). This is a protocol constant.
- **30.4375 days/month** (`DAYS_PER_MONTH` = 365.25 / 12) — the same average month used for electricity (730.5 h). Calendar months vary (28–31 days), so any single month is off by up to ~8%, averaging out over a year.
- **Transaction fees** are included. `ForecastParams.feesPerBlockBtc` defaults to the snapshot's `avgFeesPerBlockBtc` (mean of the last ~144 blocks) and is held constant over the forecast; the user can override it.

### Spot Economics

`calculateSpotEconomics` (dashboard and `POST /api/calculate` → `revenue`) evaluates the formula at today's snapshot with no growth, degradation or halvings: daily and monthly BTC, monthly revenue, OPEX, profit, and cost per BTC mined (`monthly_opex / monthly_BTC`, `null` when nothing is mined).

### Hashprice

```
hashprice ($/PH/day) = 144 * (block_subsidy + avg_fees_per_block) * btc_price / (network_EH * 1000)
```

Hashprice **includes fees**. At the golden market (964 EH/s, 3.125 + 0.027 BTC, $84,700) it is ≈ $39.88/PH/day.

**Invariant (tested):** forecast month-1 revenue ≈ hashprice (incl. fees) × farm PH × 30.4375 × uptime × (1 − pool fee), within 0.5% (`tests/forecasting.test.ts`, with zero network growth and degradation).

### ASIC Degradation

```
degradation_factor = (1 - degradation% / 100) ^ (months / 12)
```

This models exponential decay of hashrate over time due to chip aging, thermal cycling, and electromigration. The user-configurable annual rate (UI default 4%) is applied compoundly to the whole fleet.

**Accuracy note:** Real degradation is not smooth — it happens in steps as individual hash boards fail. The exponential model is a useful average over a fleet but may not match a single miner's experience.

### Pool Share

The calculation assumes the farm's hashrate is infinitesimally small relative to the network (no lucky variance). This is the **expected value** — the same as PPS payout. For PPLNS pools, actual revenue has higher variance (can be +/-30% in any given month for small farms) but converges to this expectation over time.

---

## 12. BTC Price Scenarios (Choices, Not Predictions)

The BTC price path is a **scenario the user chooses**, not a forecast. No price model is built in. `scenarioBtcPrice(params, startPrice, month)`:

```
flat:    price(m) = start
growth:  price(m) = start * (1 + annualGrowthPercent / 100) ^ (m / 12)
target:  price(m) = start + (finalBtcPrice - start) * (m / months)
```

- **Start price** = the market snapshot price, unless the user sets `startingBtcPrice`.
- **growth** compounds annually; it requires `annualGrowthPercent` > −100.
- **target** is a straight line that reaches `finalBtcPrice` in the last month; it requires `finalBtcPrice` > 0.
- **UI chips:** **Bear −30%/yr** and **Bull +30%/yr** (growth at −30 / +30), **Flat** (the default) and **Target**. A custom growth rate is a slider (−60% to +100%).
- The forecast echoes the scenario in plain words (`assumptions.priceScenario`, e.g. "flat at $84,700").
- The old Stock-to-Flow model has been **removed**. The API rejects the old `btcPriceModel` values (`fixed`, `custom`, `stock_to_flow`, `stock_to_flow_pessimistic`) with a 400 that lists `validValues`.

None of the scenarios model volatility, corrections, or drawdowns. Price is the single largest uncertainty in the forecast: compare Bear / Flat / Bull rather than trusting any one path.

---

## 13. Multi-Year Forecast Engine

The forecast runs a month-by-month simulation from month 1 to the chosen horizon (12, 24, 36, 48 or 72 months), starting from the injected snapshot and clock.

### Per-Month Calculation

For each month `m` (period date = `now` + `m` months):

1. **Network hashrate**: `network_EH = snapshot_EH * (1 + growth% / 100) ^ (m / 12)` — exponential growth from the live snapshot. Difficulty is derived from it (`H/s × 600 / 2³²`) for display.
2. **Block reward**: mean subsidy over the month's block heights (see Halvings below).
3. **BTC price**: the chosen scenario (section 12).
4. **Degradation**: `(1 - degradation%)^(m/12)` applied to farm hashrate.
5. **Revenue**: section 11 formula with this month's network hashrate, subsidy, the fees per block and price.
6. **Electricity**: month-0 electricity cost × `(1 + inflation% / 100) ^ (m / 12)` (energy inflation, default 3%/yr).
7. **Other OPEX**: maintenance + solar maintenance + maintenance labor, flat (section 9).

Month 1 already includes 1/12 of a year of network growth, degradation and inflation.

### Network Hashrate Growth Default

The Projections tab defaults `networkHashrateGrowthPercent` to the **trailing 12-month growth** of network hashrate: the annualized change between the 7-day means at each end of mempool.space `/v1/mining/hashrate/1y` (`hashrateGrowth12mPercent` on `/api/network`). The default is that rate **clamped to 0–60%**, or **10%** when the series is unavailable. Moving the slider overrides it; "use trailing rate" restores it. REST callers must send `networkHashrateGrowthPercent` explicitly and can read `hashrateGrowth12mPercent` to choose it.

### Revenue Strategies

| Strategy | BTC sold | Monthly profit (`profitUsd`) | BTC accumulated |
|---|---|---|---|
| Sell All | All mined BTC | Revenue − OPEX | 0 |
| Hold All | None | −OPEX (negative) | All mined BTC |
| Sell OPEX | Enough to cover OPEX | 0 when mined BTC covers OPEX, else Revenue − OPEX | Remainder |

NPV, IRR, total profit and `summary.roiPercent` always use `revenue - OPEX` regardless of strategy (they measure the economic value of the mining operation, not the treasury strategy). **Payback month and per-period ROI use the strategy's `profitUsd`**, so under Hold All and Sell OPEX they never reach the CAPEX.

### Halvings (from Block Height)

Halvings come from block height, not calendar dates:

```
B = 144 blocks/day * 30.4375 days = 4,383 blocks per month
month m covers heights [tip + (m-1)*B, tip + m*B)
block_reward(m) = mean subsidy over that range   (averageSubsidy)
```

The month that contains a halving gets a **block-weighted** reward. From the 2026-10-03 tip (969,763), block **1,050,000** (subsidy 3.125 → 1.5625 BTC) falls in month 19: months 1–18 are 3.125 BTC, month 19 is 2.0413 BTC, month 20 onward 1.5625 BTC.

The **next halving date** shown in the UI and echoed as `assumptions.nextHalving` is `estimateHalvingDate`: tip time + (halving height − tip) × 10 min. From tip 969,763 on 2026-10-03 that is **2028-04-12** (80,237 blocks ≈ 557 days).

---

## 14. Financial Metrics (NPV, IRR, Break-even)

### Net Present Value (NPV)

```
NPV = -CAPEX + SUM[ cash_flow_m / (1 + monthly_rate)^m ]

where monthly_rate = (1 + annual_discount_rate / 100)^(1/12) - 1
      cash_flow_m  = revenue_m - opex_m
```

Default discount rate: **10%** annual. This represents the opportunity cost of capital — what the investor could earn elsewhere. Higher rates make the project look worse; lower rates make it look better.

### Internal Rate of Return (IRR)

The annual discount rate at which NPV = 0, found by **bisection over [−99.9%, +1000%]** annual (up to 200 iterations; stops when |NPV| < $0.01).

- IRR is **`null`** when NPV has the same sign at both ends of the range — no discount rate makes the cash flows repay the CAPEX — or when there is no CAPEX (no miners). The UI shows "n/a" with the caption "cash flows never repay the CAPEX".
- IRR does not depend on the discount rate setting.
- When monthly cash flows change sign more than once (e.g. profitable before a halving, loss-making after), the bracket check can return `null` even though monthly profit was positive for a while.

### Break-even BTC Price

Two metrics are provided:

```
break_even_opex_only = total_opex_costs / total_btc_mined
break_even_with_capex = (total_opex_costs + total_capex) / total_btc_mined
```

These answer: "What average BTC price do I need over the forecast period to cover my costs?"

**Limitation:** These are flat averages. The actual break-even is path-dependent — if BTC price is low early and high late, the average may be met but cash flow is negative in early months.

### Average Hashprice

```
avg_hashprice ($/TH/day) = total_revenue / (farm_TH * months * 30.4375)
```

This is the farm's realized revenue per TH/s per day over the horizon (after uptime, pool fee, degradation, growth and halvings), in **$/TH/day** — unlike the network hashprice in section 11, which is $/PH/day.

---

## 15. Sensitivity Analysis

Four what-if scenarios are computed in the browser (Projections tab) against the base case:

| Scenario | Change | Metric |
|---|---|---|
| Electricity +20% | Increase electricity price by 20% | NPV delta |
| BTC price −10% | Every price in the scenario 10% lower (start and target) | NPV delta |
| Network growth +10% | Add 10pp to annual hashrate growth | Final month revenue delta % |
| Zero degradation | Set ASIC degradation to 0% | Total BTC mined delta % |

Each scenario runs a full forecast independently on the same snapshot. They are not combined (no compound scenarios).

---

## 16. Noise Modeling

Computed in the dashboard's noise card (`components/MetricsDashboard.tsx`):

```
miner_noise = 75 + 10 * log10(miner_count)      dB
fan_noise   = max_fan_dB + 10 * log10(fan_count) dB
cooler_noise = max_cooler_dB + 10 * log10(cooler_count) dB

combined = 10 * log10( 10^(miner/10) + 10^(fan/10) + 10^(cooler/10) )
```

- **75 dB per miner** is a typical ASIC noise level at 1 meter (range: 70–82 dB depending on model).
- The `10 * log10(N)` formula is the standard acoustic power addition for N identical incoherent sources.
- OSHA 8-hour exposure limit is 85 dB. The calculator warns when this is exceeded.

**Limitations:**
- Does not account for enclosure attenuation (containers reduce noise ~20 dB to the outside).
- Does not model distance attenuation.
- Uses a single 75 dB value for all miners regardless of actual model specs.

---

## 17. Where Computation Happens & REST API

### In the browser

The UI computes everything locally on the shared engine: `useCalculation` calls `computeFarmReport(config, market)` (`lib/farmReport.ts`) and `useForecast` calls `generateForecast`, each inside `useMemo`. The only API request the UI makes is **`GET /api/network`** (one shared poller, section 10); the catalogs are bundled. A 72-month forecast takes well under a millisecond.

### REST API

The routes wrap the same functions, so UI and API results agree for the same inputs:

| Endpoint | Body | Response |
|---|---|---|
| `GET /api/network` | — | Market snapshot + `difficulty`, `hashpriceUsdPhDay` (incl. fees), `nextHalving`, `hashrateGrowth12mPercent` (60 s cache) |
| `POST /api/calculate` | `FarmConfig` + optional `market` | `computeFarmReport`: `metrics`, ventilation, climate, derating, `revenue` (spot economics) and `assumptions.market` |
| `POST /api/forecast` | `{ config, params, market? }` | `periods`, `totalCapex`, `summary` and `assumptions` |

- **Market inputs are auto-filled** from the cached live snapshot. The optional `market` object pins any of `btcPriceUsd` (> 0), `networkHashrateEh` (> 0), `blockHeight` (integer ≥ 0) and `avgFeesPerBlockBtc` (≥ 0). The subsidy is always derived from `blockHeight` and cannot be set on its own. When all four are pinned, no upstream request is made.
- **Assumptions are echoed.** Forecast: `assumptions { market, startingBtcPrice, feesPerBlockBtc, priceScenario, daysPerMonth (30.4375), avgBlockMinutes (10), nextHalving }`. Calculate: `revenue` plus `assumptions.market`.
- **Validation.** Malformed bodies return 400 naming the field; bodies over 256 KB return 413. Removed `btcPriceModel` values return 400 with `validValues: ["flat", "growth", "target"]`.

---

## 18. Rate Limiting

`middleware.ts` rate-limits **every** `/api/*` request per client IP (`x-real-ip`, else the last `x-forwarded-for` hop) over a sliding 60-second window:

| Caller | Detected by | Limit |
|---|---|---|
| First-party (this app's UI) | `Sec-Fetch-Site: same-origin`, or an `Origin` whose host matches `Host` | 600 requests/min |
| Everyone else (scripts, curl, agents, other sites) | Anything else | 60 requests/min |

First-party and external traffic use separate buckets. Over the limit the response is 429 with `Retry-After`. The headers can be forged, which only buys the higher bucket. The limiter is **best-effort and per instance** (in-memory buckets, capped at 10,000 tracked keys); a global quota would need a shared store such as Redis.

---

## 19. Assumptions Summary

| Assumption | Value | Impact if wrong |
|---|---|---|
| Days per month | 30.4375 (365.25 / 12), for revenue and electricity | Up to ~8% variance in any single calendar month; exact over a year |
| Hours per month | 730.5 | <1% error on energy cost |
| Market inputs | Live snapshot (mempool.space, 60 s cache); dated offline estimate when unreachable | Offline estimate goes stale; it is always labelled |
| Transaction fees | Average of the last ~144 blocks, held flat | Fees are volatile; a single day's average can be unrepresentative |
| Halving timing | From block height at 10 min/block | Blocks run slightly faster while hashrate grows; real halving may come weeks earlier |
| Voltage | 220V | Current calculation only; affects breaker sizing |
| Power factor | ~1.0 | 5% underestimate of transformer sizing if PF is 0.85 |
| Miner power = nameplate | Varies | +/-10% real-world variance |
| ASIC degradation is smooth | Exponential, one rate for the fleet | Real degradation is stepwise (board failures) |
| Network growth is exponential | Default: trailing 12 months, clamped 0–60% (10% if unavailable) | Highly uncertain beyond 2 years |
| BTC price | User-chosen scenario (flat / growth / target) | Dominant uncertainty; compare scenarios |
| Air density at sea level | 1.2 kg/m^3 | 15% error at 1,500m altitude |
| Solar: 2x capacity for 24/7 offset | Global average | Latitude-dependent; could be 1.5x–3x |
| Pool revenue = expected value | PPS equivalent | PPLNS farms see higher variance |
| Copper cable weight at AWG 6 | 4 kg/100m | Simplified; depends on insulation type |

---

## 20. Known Limitations

### Not Modeled
- **Difficulty adjustment mechanics** — Real Bitcoin difficulty adjusts every 2,016 blocks based on actual block times. The forecast uses smooth exponential hashrate growth instead, and blocks per month stay at 4,383.
- **Fee dynamics** — Fees per block are held at today's average (or the user's value) for the whole forecast.
- **Per-model degradation curves** — The catalog lists year-1/2/3+ degradation per miner, but the forecast applies one annual rate to the whole fleet.
- **Battery storage** — Solar + battery could shift more consumption off-grid.
- **Seasonal temperature variation** — The climate model uses annual max temperature. A monthly temperature profile would more accurately size cooling.
- **Three-phase power distribution** — All current calculations assume single-phase 220V.
- **Miner-specific noise levels** — A flat 75 dB is used regardless of model.
- **Shipping and logistics** — Hardware costs are FOB; freight to site is not included.
- **Land cost** — Not included in CAPEX.
- **Permitting and regulatory costs** — Not modeled.
- **Downtime during setup** — Revenue starts from month 1; deployment period is not modeled.
- **Hardware resale value** — Miners have residual value at end of life (not captured).

### Simplifications
- BTC price follows a deterministic user-chosen scenario (no volatility modeling).
- Flat monthly maintenance as % of CAPEX (no escalation); only electricity inflates.
- Electricity uptime is 100% (uptime% only affects hashrate, not power consumption).
- No working capital or financing costs.

---

## 21. Accuracy Assessment

### Where the Model is Strong (within 10%)
- **Power consumption and energy costs** — Based on manufacturer specs and straightforward multiplication. Verified against real utility bills from operating farms.
- **Revenue at today's market** — Network hashrate, tip height (subsidy) and fees per block are live, fees are included, and month-1 revenue is tested against the network hashprice within 0.5%.
- **Infrastructure costs (racks, containers, transformers)** — Based on real procurement data. Prices are hardcoded in lookup tables from 2024 quotes.
- **Heat output** — Thermodynamically exact (all electrical energy becomes heat).
- **Breaker and panel sizing** — Based on NEC code, which is the actual standard electricians use.
- **Halving timing** — Derived from block height; at 10 min/block the date error is typically weeks, not months.

### Where the Model is Moderate (within 20–30%)
- **Deployment labor** — Highly variable by region, crew experience, and site conditions.
- **Cooling sizing** — The thermodynamic formulas are correct, but real installations have duct losses, recirculation, and non-ideal airflow paths that increase the requirement by 20–30%. Users should add margin.
- **Monthly OPEX** — Electricity dominates and is well-modeled; every line item is itemized (section 9). The 5% maintenance catch-all is a rough industry average.

### Where the Model is Weak (50%+ uncertainty)
- **BTC price** — The dominant uncertainty. The calculator does not predict price; it runs the scenario you choose. Compare Bear, Flat and Bull (and your own target) before drawing conclusions.
- **Network hashrate growth** — Depends on global chip manufacturing, energy markets, and regulatory environment. The trailing-12-month default is a starting point, not a forecast; it is hard to predict beyond 12 months with confidence.
- **Multi-year ROI** — Compounds the uncertainties of BTC price, network growth, fees, and ASIC degradation. The further out the forecast, the wider the confidence interval. Treat 36+ month projections as scenario analysis, not predictions.
- **Import taxes** — Tariff schedules change with trade policy. Verify current rates with a customs broker.

### Recommended Approach

1. Run the **base case** with conservative parameters (Flat price scenario, network growth at or above the trailing-12-month default, 5–8% degradation).
2. Compare the **Bear / Flat / Bull** price scenarios and check the **sensitivity analysis**.
3. Focus on **break-even BTC price** — this is the most actionable metric because it tells you the minimum BTC price needed to recover your investment, independent of price predictions.
4. Add **20–30% margin** to all cooling and electrical figures before placing orders.
5. Get **real quotes** from suppliers and licensed electricians before committing capital.

---

## 22. Verification

`tests/golden/` runs the 4 UI presets (Home, Garage, Small Farm, Industrial) through `calculateFarmMetrics` and `generateForecast` against a **frozen market** (964 EH/s, tip 969,763, fees 0.027 BTC/block, BTC $84,700, clock 2026-10-03) and the Projections-tab defaults, and compares every number with `tests/golden/fixtures/*.json` (relative tolerance 1e-9). Any engine change that moves a number must re-capture the fixtures with `pnpm test:golden:update` and explain the delta in the PR. The unit tests never touch the network (`tests/setup.ts`); see `tests/README.md` for the full suite.

---

*This document reflects the calculation engine as of October 2026. Formulas are implemented in `lib/calculations.ts`, `lib/cooling.ts`, `lib/bitcoin.ts`, `lib/unitEconomics.ts`, `lib/networkData.ts` and `lib/forecasting.ts`.*
