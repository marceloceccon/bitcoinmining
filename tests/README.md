# Tests

Comprehensive test suite for the MineForge Bitcoin Mining Farm Calculator. Tests cover core calculation logic, chain arithmetic, live market data, financial forecasting, cooling sizing, the REST API, and utility functions. A Playwright smoke suite in `e2e/` (repo root) checks the built app in a real browser.

## What the Tests Cover

### `calculations.test.ts` — Core Engineering & Cost Calculations

- **Power calculations**: Total farm power draw with parasitic load modeling (cooling, networking overhead as a configurable percentage on top of miner draw)
- **Heat output**: Watts → BTU/h conversion for thermal planning
- **Ventilation airflow**: Required m³/h and CFM for a given heat load and temperature delta
- **Electrical sizing**: Transformer kVA with 20% safety margin, amperage at 220V, cable gauge selection with copper weight modeling
- **Infrastructure costs**: Rack units ($700 per 50 miners), container shells ($6,000 per 250 miners), labor hours for deployment
- **Solar farm sizing**: Panel count, installed kW (2× oversize for day/night), area (m²/sqft), injection rate tax, maintenance OPEX
- **Cooling equipment**: Dry cooler CAPEX (hardware + plumbing + labor), air fan power draw (reported, not added to total power) and CAPEX
- **Import taxes**: Per-component tax rates applied to hardware categories
- **Full integration**: `calculateFarmMetrics` end-to-end with realistic 100-miner scenarios

### `opex.test.ts` — Itemized Monthly OPEX

- **P1.9 investigation**: The Industrial preset (500 × S21 Hyd) itemizes to electricity $102,781 (2,814 kW × 730.5 h × $0.05) + maintenance $20,848 (5%/yr of CAPEX) + maintenance labor $4,550 (130 h × $35) = $128,179/month, with no unexplained remainder
- **Dashboard = forecast**: For every preset, forecast month-1 OPEX without energy inflation equals `metrics.monthlyOpex` (both use `calculateMonthlyOpexBreakdown`)
- **Only electricity inflates**: Month-12 OPEX = electricity × inflation + flat maintenance + flat labor

### `cooling.test.ts` — Cooling Sizing (`lib/cooling.ts`)

- **Dry cooler derating**: 1.0 at 35 °C, −3 %/°C above (floor 0.5), +2 %/°C below (cap 1.3)
- **Heat load by cooling type**: A mixed farm splits into air and hydro loads, each carrying the parasitic share
- **Sizing**: Hot climates need more dry coolers and fans than cold ones; zero heat or an empty catalog returns null; CAPEX = hardware + deploy labor (+ plumbing for dry coolers)
- **One sizing path**: The store's auto-sizing, the engine's required airflow and `sizeHydroCooling`/`sizeAirCooling` agree
- **Override semantics**: Picking a location re-sizes; a manual quantity survives a location change until the miners change or the user clicks "Re-size automatically"
- **Hydro-only / air-only**: No ventilation fans for a hydro-only farm, no dry coolers for an air-only farm

### `bitcoin.test.ts` — Chain Arithmetic (`lib/bitcoin.ts`)

- **Subsidy from height**: `50 / 2^floor(h / 210,000)` (3.125 BTC at 969,763; 1.5625 from 1,050,000; 0 after 64 halvings)
- **Next halving / average subsidy**: Block 1,050,000 after the 2026 tip; a range straddling a halving is block-weighted
- **Halving date**: Block 1,050,000 lands on 2028-04-12 from tip 969,763 on 2026-10-03 at 10 min/block, and moves with the assumed block interval
- **Hashprice**: `144 × (subsidy + fees) × price / (EH × 1000)` in $/PH/day, including fees; 0 (not a division by zero) at zero hashrate

### `networkData.test.ts` — Live Market Snapshot (`lib/networkData.ts`)

- **Live snapshot**: Price, hashrate, tip height and fees per block (reward-stats/144) from mocked mempool.space responses, with a height-derived subsidy and hashprice including fees
- **Fallbacks**: CoinGecko backs up the price; a fully offline result is `FALLBACK_MARKET`, labelled "offline estimate"; a live price with a failed tip height is not `isLive`
- **Trailing 12-month hashrate growth**: Annualized change between 7-day means a year apart (can be negative; null for short series); the forecast default clamps it to 0–60 % (10 % when unavailable)

### `forecasting.test.ts` — Financial & Mining Economics

Every forecast gets an injected `MarketSnapshot` and clock (never constants or the system clock).

- **Hashprice invariant**: Month-1 revenue = hashprice (incl. fees) × farm PH × 30.4375 × uptime × (1 − pool fee), within 0.5%
- **Transaction fees**: Revenue scales by (subsidy + fees) / subsidy; `feesPerBlockBtc` defaults to the snapshot average
- **Halvings from block height**: 3.125 BTC below block 1,050,000; the month containing it gets a block-weighted reward, later months 1.5625; a snapshot closer to the halving moves the drop earlier
- **Difficulty adjustment modeling**: Exponential network hashrate growth from the snapshot, difficulty = (hashrate × 600) / 2³²
- **Hardware degradation**: Compound annual hashrate decay, e.g. 5%/year → factor = (0.95)^years
- **Pool fee structures**: Percentage-based deduction on gross BTC mined (PPS/FPPS/PPLNS modeled as a flat fee percentage)
- **Revenue modes**: sell_all (immediate liquidation), hold_all (stack sats), sell_opex (sell just enough to cover costs)
- **BTC price scenarios** (choices, not predictions): flat (constant), growth (compounds `annualGrowthPercent`, e.g. bear −30% / bull +30%), target (straight line to `finalBtcPrice` at the last month); the start price is the market price unless overridden
- **Break-even analysis**: OPEX-only break-even price and OPEX+CAPEX break-even price
- **NPV & IRR**: Net present value with configurable discount rate; IRR solves NPV = 0 by bisection, and is `null` (not −99%) when the cash flows never repay the CAPEX or there is no CAPEX
- **Energy inflation**: Compound annual electricity cost growth
- **Payback period**: Month when cumulative profit exceeds total CAPEX
- **Hashprice**: Average $/TH/day across the forecast horizon

### `golden/` — Golden Fixtures (engine regression net)

- Runs the 4 UI presets (Home, Garage, Small Farm, Industrial) through `calculateFarmMetrics` and `generateForecast` with a frozen clock (2026-10-03), a frozen market (964 EH/s, tip 969,763, fees 0.027 BTC/block, BTC $84,700) and the Projections-tab default parameters
- Compares every number against `golden/fixtures/<preset>.json` (relative tolerance 1e-9) and reports the first differing path
- Any engine change that moves a number must re-capture with `pnpm test:golden:update` **and** explain the delta in the PR body

### `store.test.ts` — Farm Store

- Catalog setters re-run cooling auto-sizing (no duplicate or stale selections)
- Basic invariants: add/remove miners, quantity floor of 1, reset, partial updates, default config values

### `api.calculate.test.ts` / `api.forecast.test.ts` — REST Endpoints

- Happy paths, CORS, ISO date serialization, 400s with the offending field path, 413 for oversized bodies
- **Market inputs**: Filled from the server snapshot when omitted; pinned `market` values win (a fully pinned market makes no snapshot request); an invalid override is a 400
- **Assumptions echo**: Forecast `assumptions` (market, starting price, fees, price scenario, next halving); calculate `revenue` + `assumptions.market`
- Removed `btcPriceModel` values (e.g. Stock-to-Flow) return 400 with `validValues`

### `middleware.test.ts` — Rate Limiting

- Every `/api` request is limited per IP: first-party (`Sec-Fetch-Site: same-origin` or matching `Origin`) at 600/min, everyone else at 60/min, in separate buckets
- Client IP resolution (`x-real-ip`, else the last `x-forwarded-for` hop), 429 with `Retry-After`, malformed `Origin` handling, stale-entry pruning and eviction

### Other unit tests

- **`validateFarmConfig.test.ts`**: Request-body validation for configs, forecast params and size limits
- **`api.catalog.test.ts`**: Catalog routes, caching, and `data/*.json` as the single catalog source
- **`api.docs.test.ts`**, **`cors.test.ts`**, **`serverCache.test.ts`**: API docs page, CORS headers, TTL cache

### `utils.test.ts` — Formatting & Utilities

- Currency, BTC, hashrate, power, percentage, and number formatting
- Date formatting
- Debounce behavior (timer reset, argument forwarding)
- ROI color classification
- Unique ID generation

### `setup.ts` — No-Network Guard

- Stubs `fetch` before every test so unit tests can never hit the network; market code falls back to the dated offline snapshot, and tests that need specific responses stub `fetch` themselves

### `e2e/smoke.spec.ts` — Playwright Smoke (repo root)

- Runs against a production build at desktop (1440 px) and mobile (390 px) widths
- The page loads without console errors, every preset renders metrics, every tab renders, the map modal opens and closes with Escape
- **Calculations run in the browser**: Loading a preset and opening Projections makes no API call other than `GET /api/network`

## Mathematical Fundamentals

### Power & Energy

- **kW to kWh**: `kWh = kW × hours`. Monthly hours = 730.5 (30.4375 days × 24; 30.4375 = 365.25 / 12).
- **Parasitic load**: Total power = miner power × (1 + parasitic%). Models cooling fans, networking gear, PDUs, and lighting as a percentage overhead. Typical range: 3–15%.

### Thermodynamics

- **Heat dissipation**: Every watt consumed by a miner is eventually converted to heat. Conversion factor: **1 W = 3.412 BTU/h** (exact by definition of BTU).
- **Airflow requirements**: Derived from `Q = P / (ρ × Cp × ΔT)` where:
  - ρ = 1.2 kg/m³ (air density at ~25°C)
  - Cp = 1,005 J/(kg·K) (specific heat of air)
  - ΔT = 15°C (assumed temperature rise across the mining hall)
  - Result: ~200 m³/h per kW of heat dissipated
  - CFM conversion: 1 m³/h ≈ 0.5886 CFM

### Electrical Engineering

- **kVA sizing**: Apparent power requirement = real power (kW) × 1.2 safety factor. The 20% margin accounts for power factor correction, inrush current, and future expansion headroom.
- **Amperage**: I = P / V at 220V single-phase industrial supply.
- **Cable gauge selection**: AWG cross-sectional area doubles every 3 gauge numbers. Weight model: base 4 kg/100m at AWG 6, scaled by `2^((6 - gauge) / 3)`. Total cable cost = copper weight × $/kg + installation at $15/m.
- **Transformer auto-selection**: Lookup table from 15 kVA to 2,500 kVA. Farms under 15 kVA use existing supply (no dedicated transformer). Loads exceeding 2,500 kVA use multiple units.

### Bitcoin Mining Economics

- **Hashrate share**: `farmHashrate_EH / networkHashrate_EH` — your proportional share of every block found globally. Network hashrate comes from the live market snapshot.
- **Block subsidy**: `50 / 2^floor(height / 210,000)` — 3.125 BTC since block 840,000; 1.5625 BTC from block 1,050,000 (≈ 2028-04-12 at 10 min/block from the 2026-10-03 tip).
- **Daily blocks**: 144 blocks/day (one every ~600 seconds). Monthly: 144 × 30.4375 = 4,383.
- **BTC mined per month**: `4,383 × (subsidy + feesPerBlock) × hashShare × (1 - poolFee%) × uptimePercent × degradationFactor`. In a halving month the subsidy is block-weighted.
- **Hashprice**: `144 × (subsidy + fees) × price / (networkHashrate_EH × 1000)` in $/PH/day, including transaction fees.
- **Difficulty**: `difficulty = (networkHashrate_H/s × 600) / 2^32`. Adjusts every 2,016 blocks to maintain the 10-minute block target.
- **Pool fee structures**:
  - **PPS** (Pay Per Share): Fixed payout per share submitted, pool absorbs variance.
  - **FPPS** (Full Pay Per Share): PPS + transaction fee revenue share.
  - **PPLNS** (Pay Per Last N Shares): Payout proportional to recent contribution; higher variance, lower fees.
  - In the calculator, all structures are modeled as a configurable percentage deduction on gross BTC mined.
- **BTC price scenarios**: flat, growth (`start × (1 + g)^(month / 12)`), or target (straight line to the final-month price). Scenarios are user choices, not price predictions.

### Financial

- **CAPEX breakdown**: Miners + transformer + cabling + racks/containers + cooling equipment + solar installation (only when opted in) + deployment labor + cables/breakers per miner + import taxes.
- **OPEX breakdown**: Grid electricity (after solar offset and injection rate tax) + equipment maintenance (% of CAPEX / 12) + solar panel maintenance + maintenance labor hours. Only electricity inflates in the forecast.
- **Break-even analysis**:
  - OPEX break-even: `totalOPEX / totalBtcMined` — the BTC price at which mining revenue covers operating costs.
  - Full break-even: `(totalOPEX + totalCAPEX) / totalBtcMined` — includes initial investment recovery.
- **NPV** (Net Present Value): Sum of discounted monthly cash flows minus initial investment. Monthly discount rate derived from annual: `r_monthly = (1 + r_annual)^(1/12) - 1`.
- **IRR** (Internal Rate of Return): The discount rate that makes NPV = 0. Found via bisection over the range [-99.9%, 1000%] annual; `null` when NPV does not change sign over that range (the cash flows never repay the CAPEX) or there is no CAPEX.
- **Payback period**: The first month where cumulative profit ≥ total CAPEX.
- **Hashprice (forecast)**: Average revenue per TH/s per day across the forecast period, a standard industry profitability metric.

## Running the Tests

```bash
# Run all unit tests once
pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test:watch

# Run a specific test file
pnpm vitest run tests/calculations.test.ts

# Run tests matching a pattern
pnpm vitest run -t "heat output"

# Run with verbose output
pnpm vitest run --reporter=verbose

# Re-capture the golden fixtures after an intended engine change
pnpm test:golden:update

# Playwright smoke e2e (against a production build)
pnpm build && pnpm test:e2e
```

## Adding New Tests

1. Create or edit a file in the `tests/` directory with the `.test.ts` extension.
2. Import `describe`, `it`, `expect` from `vitest`.
3. Import the functions you want to test from `@/lib/...`.
4. Use the existing helper functions (`makeFarmConfig`, `withMiners`) to build test fixtures.
5. Pass market state explicitly: build a `MarketSnapshot` (or reuse `GOLDEN_MARKET` from `golden/cases.ts`) and a fixed `now`. Unit tests cannot reach the network.
6. Follow the naming convention: descriptive `it('...')` strings that explain **what** is being verified and **why**.

### Example

```typescript
import { describe, it, expect } from 'vitest';
import { calculateTotalPower } from '@/lib/calculations';

describe('calculateTotalPower', () => {
  it('returns 0 for an empty farm', () => {
    const config = makeFarmConfig(); // uses helper from test file
    expect(calculateTotalPower(config)).toBe(0);
  });
});
```

### Conventions

- **Realistic data**: Use actual ASIC specifications (S21 Pro, S21 Hydro, etc.) rather than arbitrary numbers.
- **Edge cases**: Always test zero miners, single miner, and large farms (100+).
- **Known values**: Verify against hand-calculated expected results, not just "it returns something".
- **Descriptive names**: `it('10 × S21 Pro at 5% parasitic = 36.855 kW')` > `it('calculates power')`.
- **Independence**: Each test should be self-contained and not depend on execution order.
- **Injected market**: Never rely on live data or hardcoded market constants; pass the snapshot in.

### `data.miners.test.ts` — Catalog integrity (schema v2)

- Every row of `data/miners.json` has all schema-v2 fields with valid values, `watercooled === (cooling !== "air")`, and `|W ÷ TH/s − J/TH| ÷ J/TH < 3 %`
- Ids are unique and URL-safe; `announced` models are never used by presets; `updates.json` is not older than the newest price
- Prices older than 120 days only print a warning, so data ages visibly without breaking CI

### `presets.test.ts` — Presets resolve and make money

- Every preset resolves its miner ids from the catalog and is OPEX-profitable at the default $0.05/kWh at the 2026-10-03 snapshot (`FALLBACK_MARKET`)
- Farm presets stay cash-positive over a flat-price 48-month forecast; the home preset needs no transformer; the industrial preset is hydro-cooled
- A fresh store opens on the Small Farm preset, and `applyPreset` equals `buildPresetConfig`

### UI engine helpers and integrations (P4–P5)

- `schematicLayout.test.ts`: the live farm schematic layout is deterministic, groups large farms as ×N, scales power flow with MW and the heat plume with heat and climate
- `sensitivity.test.ts`: the key-drivers tornado (downside below / upside above base NPV, sorted by swing)
- `climate.test.ts`: ERA5 summary and Nominatim place search mapping
- `share.test.ts`: share links round-trip, store catalog miners by id (no stale prices), compress large payloads, reject garbage
- `mcp.tools.test.ts`: every MCP tool as a plain function (happy path, unknown ids with suggestions, bad input, assumptions echo, dependency failures); `calculate_farm(Small Farm)` equals the UI engine exactly
- `mcp.route.test.ts`: JSON-RPC `tools/list`, `tools/call`, resources and prompts through `/api/mcp`
- `registryAuth.test.ts`: `/.well-known/mcp-registry-auth` serves only a well-formed public key line
