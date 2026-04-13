# Bitcoin Mining Farm Calculator — Calculation Architecture

This document describes every formula, assumption, and limitation in the calculation engine. It is intended for developers integrating with the API, auditors verifying the math, and operators who need to understand what the numbers mean before committing capital.

The engine has two layers: **CAPEX/OPEX metrics** (instantaneous farm economics) and **multi-year forecasting** (time-series revenue projection). Both are pure functions — given the same input, they always produce the same output.

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
10. [Bitcoin Mining Revenue](#10-bitcoin-mining-revenue)
11. [BTC Price Modeling (Stock-to-Flow)](#11-btc-price-modeling-stock-to-flow)
12. [Multi-Year Forecast Engine](#12-multi-year-forecast-engine)
13. [Financial Metrics (NPV, IRR, Break-even)](#13-financial-metrics-npv-irr-break-even)
14. [Sensitivity Analysis](#14-sensitivity-analysis)
15. [Noise Modeling](#15-noise-modeling)
16. [Assumptions Summary](#16-assumptions-summary)
17. [Known Limitations](#17-known-limitations)
18. [Accuracy Assessment](#18-accuracy-assessment)

---

## 1. Power & Energy

### Total Power Draw

```
P_total (kW) = [ SUM(miner_watts_i * quantity_i) * (1 + parasitic_load_% / 100) ] / 1000
```

- **Parasitic load** (default 5%) accounts for networking equipment, control systems, lighting, and miscellaneous facility loads that are not the miners themselves.
- The parasitic load percentage is user-adjustable (0–20%).

### Monthly Energy

```
monthly_kWh = P_total (kW) * 730
```

- **730 hours/month** is the standard engineering average (365.25 days/year * 24 hours / 12 months = 730.5).
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

- **220V** is assumed as the standard industrial single-phase voltage. Three-phase installations would use 380–480V, reducing current. This is a simplification — the calculator does not model three-phase distribution, though it recommends it above 75 kVA.

### Transformer Sizing

```
kVA_required = P_total (kW) * 1.2
```

- The **20% overhead** accounts for power factor correction, inrush current during startup, and future expansion headroom. Industry practice ranges from 15–25%.
- Farms under **15 kVA** (roughly 4 miners) do not need a dedicated transformer — standard residential/commercial service suffices.
- Transformer selection uses a lookup table of 15 real models from 15 kVA to 2,500 kVA. For loads exceeding 2,500 kVA, multiple units of the largest transformer are used.

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

```
main_breaker = total_amps / 0.8      (NEC 80% continuous load rule)
branch_circuits = ceil(total_amps / 24)  (30A breakers at 80% = 24A usable)
panel_slots = ceil(circuits / 2) * 2     (panels have even slot counts)
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

### Climate Model

When a location is selected (via map pick with ERA5 climate data), the engine uses the site's `maxTempC` and `avgHumidityPercent` to adjust cooling calculations. When no location is set, a **temperate fallback** is used:

| Parameter | Default Value | Rationale |
|---|---|---|
| Average yearly temp | 25°C | Mid-latitude temperate (US Mid-Atlantic) |
| Maximum temp | 35°C | Baseline rating for dry coolers |
| Minimum temp | 5°C | Not used in calculations currently |
| Average humidity | 60% | Below the 70% penalty threshold |

At these defaults, all cooling formulas produce identical results to a non-climate-aware model.

### Air Cooling — Ventilation Requirement

Base thermodynamic formula:

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

Dry coolers are rated at 35°C ambient. Performance changes with actual site temperature:

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

This derated capacity is used for sizing warnings ("undersized" / "oversized") and auto-configuration.

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

The **injection rate** models net metering policies. At 100%, all surplus solar energy exported to the grid is credited 1:1. Lower values represent "injection taxes" where the utility credits only a fraction of exported energy.

### Solar CAPEX

```
solar_capex = solar_kW_installed * cost_per_kW
```

Default: $1,200/kW. Commercial-scale solar installations typically range $800–$1,500/kW depending on location, ground conditions, and grid interconnection costs.

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

**Defaults:**

| Parameter | Default | Range |
|---|---|---|
| Hours per miner | 2.5 | 1.5–4 |
| Hours per transformer | 8 | 6–16 |
| Hours per rack | 4 | 2–6 |
| Hours per container | 40 | 24–60 |
| Hourly labor rate | $35 | $25–$60 |
| Cables & breaker per miner | $85 | Materials only |

### Maintenance Labor (OPEX)

```
if miners <= 20:
  monthly_hours = 8
else:
  monthly_hours = 30 + (miners * 0.2) + (air_fan_units * 1)

monthly_cost = monthly_hours * hourly_maintenance_rate
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
            + solar_capex
            + deployment_labor
            + cables_and_breakers
            + dry_cooler_capex
            + air_fan_capex
            + import_tax_capex
```

Twelve line items. All are deterministic given the input configuration.

---

## 9. Monthly OPEX

```
electricity_cost = grid_kWh * price_per_kWh * (1 + tax_adder% / 100)
maintenance_cost = (total_capex * maintenance_opex% / 100) / 12
solar_maintenance = (solar_capex * solar_maintenance% / 100) / 12
labor_maintenance = monthly_maintenance_hours * hourly_rate

monthly_opex = electricity_cost + maintenance_cost + solar_maintenance + labor_maintenance
```

Where:
```
grid_kWh = monthly_kWh * (1 - effective_solar_coverage / 100)
```

**Note:** The `maintenance_cost` (default 5% of CAPEX/year) is a catch-all for equipment repairs, replacement parts, insurance, and facility overhead. It does NOT include electricity or labor, which are calculated separately.

---

## 10. Bitcoin Mining Revenue

### Core Formula

```
effective_hashrate_TH = farm_hashrate_TH * degradation_factor * (uptime% / 100)
pool_share = effective_hashrate_EH / network_hashrate_EH
monthly_blocks = 144 * 30 * pool_share
btc_mined = monthly_blocks * block_reward * (1 - pool_fee% / 100)
revenue_usd = btc_mined * btc_price
```

**Constants:**
- **144 blocks/day** — Bitcoin targets one block every 600 seconds (10 minutes). This is a protocol constant.
- **30 days/month** — Used for monthly calculations. Real months vary (28–31 days), introducing up to 10% variance in any single month, but averaging out over a year.

### ASIC Degradation

```
degradation_factor = (1 - degradation% / 100) ^ (months / 12)
```

This models exponential decay of hashrate over time due to chip aging, thermal cycling, and electromigration. The user-configurable annual rate (default 4%) is applied compoundly.

**Accuracy note:** Real degradation is not smooth — it happens in steps as individual hash boards fail. The exponential model is a useful average over a fleet but may not match a single miner's experience.

### Pool Share

The calculation assumes the farm's hashrate is infinitesimally small relative to the network (no lucky variance). This is the **expected value** — the same as PPS payout. For PPLNS pools, actual revenue has higher variance (can be +/-30% in any given month for small farms) but converges to this expectation over time.

---

## 11. BTC Price Modeling (Stock-to-Flow)

### Formula

```
stock = 19,800,000 BTC     (approximate circulating supply, 2026)
flow  = 144 * 365 * block_reward   (annual new supply)
SF    = stock / flow
price = 0.4 * SF^3
```

The **Stock-to-Flow (S2F)** model was popularized by PlanB. It treats Bitcoin like a scarce commodity (gold, silver) where price correlates with the scarcity ratio.

### Price Interpolation

The forecast uses **linear interpolation** from the starting BTC price to the target price:

```
btc_price(month) = start_price + (final_price - start_price) * (month / total_months)
```

This means the price changes at a constant rate each month. It does NOT model volatility, corrections, or the typically rapid post-halving appreciation that S2F proponents expect.

### Price Modes

| Mode | Final Price |
|---|---|
| Fixed | Same as starting price (flat) |
| Stock-to-Flow | S2F model output for the end date |
| S2F Pessimistic | S2F output discounted by pessimism% (e.g., -30%) |
| Custom | User-specified target |

### Floor Price

The S2F model has a floor of **$10,000** — if the formula produces a value below this, $10,000 is used instead. This prevents unrealistic sub-$10K projections for very high block rewards.

**Critical limitations of S2F:**
- S2F is a **contested model**. Many economists and analysts reject it as unfalsifiable or statistically flawed.
- It does not account for demand-side dynamics, regulatory events, or macroeconomic conditions.
- Historical correlation does not imply causation or future predictive power.
- The simplified `0.4 * SF^3` formula is an approximation of PlanB's original regression. Different coefficient choices produce very different prices.
- **This model should NOT be used as investment advice.** It is provided as one of several scenario-planning tools.

---

## 12. Multi-Year Forecast Engine

The forecast runs a month-by-month simulation from month 1 to the chosen horizon (12–72 months).

### Per-Month Calculation

For each month `m`:

1. **Network hashrate**: `network_EH = 750 * (1 + growth% / 100) ^ (m / 12)` — exponential growth from the 2026 baseline.
2. **Block reward**: Checked against the halving schedule (2028, 2032, 2036, 2040). Reward steps down at each halving.
3. **BTC price**: Linear interpolation from start to final target.
4. **Degradation**: `(1 - degradation%)^(m/12)` applied to farm hashrate.
5. **Revenue**: Pool share * blocks * reward * (1 - pool fee) * BTC price.
6. **Electricity**: Grid kWh * base rate * inflation factor. Inflation is compounded: `(1 + inflation% / 100) ^ (m / 12)`.
7. **Maintenance**: `total_capex * maintenance% / 100 / 12` (flat monthly).

### Revenue Strategies

| Strategy | BTC sold | Cash flow | BTC accumulated |
|---|---|---|---|
| Sell All | All mined BTC | Revenue - OPEX | 0 |
| Hold All | None | -OPEX (negative) | All mined BTC |
| Sell OPEX | Enough to cover OPEX | ~0 (break-even) | Remainder |

NPV/IRR calculations always use `revenue - OPEX` regardless of strategy (they measure the economic value of the mining operation, not the treasury strategy).

### Halving Schedule

| Date | Block Reward |
|---|---|
| Now–April 2028 | 3.125 BTC |
| April 2028 | 1.5625 BTC |
| April 2032 | 0.78125 BTC |
| April 2036 | 0.390625 BTC |
| April 2040 | 0.1953125 BTC |

Halving dates are approximations (±6 months). The actual halving depends on block height, not calendar date.

---

## 13. Financial Metrics (NPV, IRR, Break-even)

### Net Present Value (NPV)

```
NPV = -CAPEX + SUM[ cash_flow_m / (1 + monthly_rate)^m ]

where monthly_rate = (1 + annual_discount_rate / 100)^(1/12) - 1
```

Default discount rate: **10%** annual. This represents the opportunity cost of capital — what the investor could earn elsewhere. Higher rates make the project look worse; lower rates make it look better.

### Internal Rate of Return (IRR)

Calculated via **bisection method** (100 iterations, search range -99% to +500% annual). The IRR is the discount rate at which NPV = 0.

**Convergence:** 100 iterations of bisection gives precision to ~0.01%. The algorithm converges when |NPV| < $0.01.

### Break-even BTC Price

Two metrics are provided:

```
break_even_opex_only = total_opex_costs / total_btc_mined
break_even_with_capex = (total_opex_costs + total_capex) / total_btc_mined
```

These answer: "What average BTC price do I need over the forecast period to cover my costs?"

**Limitation:** These are flat averages. The actual break-even is path-dependent — if BTC price is low early and high late, the average may be met but cash flow is negative in early months.

---

## 14. Sensitivity Analysis

Four what-if scenarios are computed against the base case:

| Scenario | Change | Metric |
|---|---|---|
| Electricity +20% | Increase electricity price by 20% | NPV delta |
| BTC price -10% | Reduce final BTC price by 10% | NPV delta |
| Network growth +10% | Add 10pp to annual hashrate growth | Final month revenue delta % |
| Zero degradation | Set ASIC degradation to 0% | Total BTC mined delta % |

Each scenario runs a full forecast independently. They are not combined (no compound scenarios).

---

## 15. Noise Modeling

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

## 16. Assumptions Summary

| Assumption | Value | Impact if wrong |
|---|---|---|
| Hours per month | 730 | <1% error on energy cost |
| Voltage | 220V | Current calculation only; affects breaker sizing |
| Months = 30 days | 30 | Up to 10% variance in any single month |
| Power factor | ~1.0 | 5% underestimate of transformer sizing if PF is 0.85 |
| Miner power = nameplate | Varies | +/-10% real-world variance |
| ASIC degradation is smooth | Exponential | Real degradation is stepwise (board failures) |
| Network growth is exponential | User-set | 10-60% typical; highly uncertain beyond 2 years |
| S2F price model is valid | Contested | Could be off by 50%+ in either direction |
| Air density at sea level | 1.2 kg/m^3 | 15% error at 1,500m altitude |
| Solar: 2x capacity for 24/7 offset | Global average | Latitude-dependent; could be 1.5x–3x |
| Pool revenue = expected value | PPS equivalent | PPLNS farms see higher variance |
| Block reward timing | Fixed schedule | ±6 months on halving dates |
| Copper cable weight at AWG 6 | 4 kg/100m | Simplified; depends on insulation type |

---

## 17. Known Limitations

### Not Modeled
- **Difficulty adjustment mechanics** — Real Bitcoin difficulty adjusts every 2,016 blocks based on actual block times. The forecast uses smooth exponential hashrate growth instead.
- **Transaction fee revenue** — Only block subsidy is modeled. Transaction fees (currently 10–30% of miner revenue) are excluded. This makes revenue estimates **conservative**.
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
- Linear BTC price interpolation (no volatility modeling).
- Flat monthly maintenance as % of CAPEX (no escalation).
- Electricity uptime is 100% (uptime% only affects hashrate, not power consumption).
- No working capital or financing costs.

---

## 18. Accuracy Assessment

### Where the Model is Strong (within 10%)
- **Power consumption and energy costs** — Based on manufacturer specs and straightforward multiplication. Verified against real utility bills from operating farms.
- **Infrastructure costs (racks, containers, transformers)** — Based on real procurement data. Prices are hardcoded in lookup tables from 2024 quotes.
- **Heat output** — Thermodynamically exact (all electrical energy becomes heat).
- **Breaker and panel sizing** — Based on NEC code, which is the actual standard electricians use.

### Where the Model is Moderate (within 20–30%)
- **Deployment labor** — Highly variable by region, crew experience, and site conditions. The defaults represent US industrial rates.
- **Cooling sizing** — The thermodynamic formulas are correct, but real installations have duct losses, recirculation, and non-ideal airflow paths that increase the requirement by 20–30%. Users should add margin.
- **Monthly OPEX** — Electricity dominates and is well-modeled. The 5% maintenance catch-all is a rough industry average.

### Where the Model is Weak (50%+ uncertainty)
- **BTC price projections** — The Stock-to-Flow model is fundamentally speculative. Historical correlation is not predictive. Use multiple price scenarios.
- **Network hashrate growth** — Depends on global chip manufacturing, energy markets, and regulatory environment. Impossible to predict beyond 12 months with confidence.
- **Multi-year ROI** — Compounds the uncertainties of BTC price, network growth, and ASIC degradation. The further out the forecast, the wider the confidence interval. Treat 36+ month projections as scenario analysis, not predictions.
- **Import taxes** — Tariff schedules change with trade policy. Verify current rates with a customs broker.

### Recommended Approach

1. Run the **base case** with conservative parameters (fixed BTC price, 25% network growth, 8% degradation).
2. Run **pessimistic** and **optimistic** scenarios using the sensitivity analysis.
3. Focus on **break-even BTC price** — this is the most actionable metric because it tells you the minimum BTC price needed to recover your investment, independent of price predictions.
4. Add **20–30% margin** to all cooling and electrical figures before placing orders.
5. Get **real quotes** from suppliers and licensed electricians before committing capital.

---

*This document reflects the calculation engine as of April 2026. All formulas are implemented in `lib/calculations.ts` and `lib/forecasting.ts`.*
