# Tests

Comprehensive test suite for the MineForge Bitcoin Mining Farm Calculator. Tests cover core calculation logic, financial forecasting, and utility functions.

## What the Tests Cover

### `calculations.test.ts` — Core Engineering & Cost Calculations

- **Power calculations**: Total farm power draw with parasitic load modeling (cooling, networking overhead as a configurable percentage on top of miner draw)
- **Heat output**: Watts → BTU/h conversion for thermal planning
- **Ventilation airflow**: Required m³/h and CFM for a given heat load and temperature delta
- **Electrical sizing**: Transformer kVA with 20% safety margin, amperage at 220V, cable gauge selection with copper weight modeling
- **Infrastructure costs**: Rack units ($700 per 50 miners), container shells ($6,000 per 250 miners), labor hours for deployment
- **Solar farm sizing**: Panel count, installed kW (2× oversize for day/night), area (m²/sqft), injection rate tax, maintenance OPEX
- **Cooling equipment**: Dry cooler CAPEX (hardware + plumbing + labor), air fan power draw and CAPEX
- **Import taxes**: Per-component tax rates applied to hardware categories
- **Full integration**: `calculateFarmMetrics` end-to-end with realistic 100-miner scenarios

### `forecasting.test.ts` — Financial & Mining Economics

- **BTC revenue projections**: Hashrate share of network, block reward, pool fee deduction, uptime adjustment
- **Difficulty adjustment modeling**: Exponential network hashrate growth, difficulty = (hashrate × 600) / 2³²
- **Halving schedule**: Block reward transitions (3.125 → 1.5625 BTC at April 2028)
- **Hardware degradation**: Compound annual hashrate decay, e.g. 5%/year → factor = (0.95)^years
- **Pool fee structures**: Percentage-based deduction on gross BTC mined (PPS/FPPS/PPLNS modeled as a flat fee percentage)
- **Revenue modes**: sell_all (immediate liquidation), hold_all (stack sats), sell_opex (sell just enough to cover costs)
- **Break-even analysis**: OPEX-only break-even price and OPEX+CAPEX break-even price
- **NPV & IRR**: Net present value with configurable discount rate, internal rate of return via bisection
- **BTC price interpolation**: Linear interpolation from starting to final target price
- **Energy inflation**: Compound annual electricity cost growth
- **Payback period**: Month when cumulative profit exceeds total CAPEX
- **Hashprice**: $/TH/day average across the forecast horizon

### `utils.test.ts` — Formatting & Utilities

- Currency, BTC, hashrate, power, percentage, and number formatting
- Date formatting
- Debounce behavior (timer reset, argument forwarding)
- ROI color classification
- Unique ID generation

## Mathematical Fundamentals

### Power & Energy

- **kW to kWh**: `kWh = kW × hours`. Monthly hours constant = 730 (365.25 × 24 / 12).
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

- **Hashrate share**: `farmHashrate_EH / networkHashrate_EH` — your proportional share of every block found globally.
- **Block reward**: Currently 3.125 BTC (post-April 2024 halving). Halves every ~210,000 blocks (~4 years). Next halving: ~April 2028 → 1.5625 BTC.
- **Daily blocks**: 144 blocks/day (one every ~600 seconds). Monthly: 144 × 30 = 4,320.
- **BTC mined per month**: `monthlyBlocks × blockReward × hashShare × (1 - poolFee%) × uptimePercent × degradationFactor`.
- **Difficulty**: `difficulty = (networkHashrate_H/s × 600) / 2^32`. Adjusts every 2,016 blocks to maintain the 10-minute block target.
- **Pool fee structures**:
  - **PPS** (Pay Per Share): Fixed payout per share submitted, pool absorbs variance.
  - **FPPS** (Full Pay Per Share): PPS + transaction fee revenue share.
  - **PPLNS** (Pay Per Last N Shares): Payout proportional to recent contribution; higher variance, lower fees.
  - In the calculator, all structures are modeled as a configurable percentage deduction on gross BTC mined.
- **Stock-to-Flow price model**: `Price = 0.4 × SF³` where SF = existing supply / annual new supply. Predicts higher prices after each halving due to reduced flow.

### Financial

- **CAPEX breakdown**: Miners + transformer + cabling + racks/containers + cooling equipment + solar installation + deployment labor + cables/breakers per miner + import taxes.
- **OPEX breakdown**: Grid electricity (after solar offset and injection rate tax) + equipment maintenance (% of CAPEX / 12) + solar panel maintenance + maintenance labor hours.
- **Break-even analysis**:
  - OPEX break-even: `totalOPEX / totalBtcMined` — the BTC price at which mining revenue covers operating costs.
  - Full break-even: `(totalOPEX + totalCAPEX) / totalBtcMined` — includes initial investment recovery.
- **NPV** (Net Present Value): Sum of discounted monthly cash flows minus initial investment. Monthly discount rate derived from annual: `r_monthly = (1 + r_annual)^(1/12) - 1`.
- **IRR** (Internal Rate of Return): The discount rate that makes NPV = 0. Found via bisection method over the range [-99%, 500%] annual.
- **Payback period**: The first month where cumulative profit ≥ total CAPEX.
- **Hashprice**: Average revenue per TH/s per day across the forecast period, a standard industry profitability metric.

## Running the Tests

```bash
# Run all tests once
npm run test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run a specific test file
npx vitest run tests/calculations.test.ts

# Run tests matching a pattern
npx vitest run -t "heat output"

# Run with verbose output
npx vitest run --reporter=verbose
```

## Adding New Tests

1. Create or edit a file in the `tests/` directory with the `.test.ts` extension.
2. Import `describe`, `it`, `expect` from `vitest`.
3. Import the functions you want to test from `@/lib/...`.
4. Use the existing helper functions (`makeFarmConfig`, `withMiners`) to build test fixtures.
5. Follow the naming convention: descriptive `it('...')` strings that explain **what** is being verified and **why**.

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
