# P1 — Engine correctness

Branch `revamp/p1-engine` (stacked on `revamp/p0-hygiene`) → `main`. Spec: `tasks/todo.md` §5 P1.

Principle: **market state is an input, never a constant.** A single `MarketSnapshot` goes from `lib/networkData.ts` to the UI, the REST API and the tests.

## What changed
- **P1.8 Single catalog source:** `lib/catalog.ts` imports `data/*.json`. The duplicate TS catalogs and the fs loader are gone.
- **P1.7 Single cooling path:** `lib/cooling.ts` (pure, with derating) is used by the store's auto-sizing, the Thermal tab and the engine. Picking a location re-sizes cooling. Manual quantities stick until the miners change or you click "Re-size automatically". Mixed farms size each cooling type against its own heat load.
- **P1.1–P1.3 MarketSnapshot, live chain data, halvings by height:** `generateForecast(config, params, market, now)` takes the market and the clock as inputs. Live data now includes tip height and fees per block (mempool.space `reward-stats/144`), and hashprice includes fees. `FALLBACK_MARKET` is the one dated offline estimate. Subsidy comes from height, and the halving month is block-weighted.
- **P1.4 Revenue accuracy:** revenue now counts tx fees (editable "Tx fees per block"), and months are 30.4375 days for both revenue and electricity. `lib/unitEconomics.ts` is the single revenue formula. An invariant test checks that month-1 revenue matches hashprice incl. fees within 0.5%.
- **P1.5 Price scenarios replace S2F (breaking):** the price model is flat, growth (Bear −30%/yr, Bull +30%/yr, or custom) or a target price. These are labelled as scenarios you choose, not predictions. All S2F code and copy is removed. `/api/forecast` returns 400 `{ error, field, validValues }` for the old enum values.
- **P1.9 OPEX investigation:** the "~$100k unexplained" doesn't exist; Industrial itemizes to $128,179/month. The real bug was that forecast OPEX left out maintenance labor and solar maintenance. Fixed with a shared `calculateMonthlyOpexBreakdown`.
- **P1.13 IRR:** `null` ("n/a") when no discount rate repays CAPEX. Before, every preset showed −99.0%.
- **P1.6 API contract:** `/api/forecast` and `/api/calculate` fill market inputs from the live snapshot and accept an optional `market` override. Responses include `assumptions` (market, start price, fees, scenario, next halving). `/api/calculate` adds a spot `revenue` block. OpenAPI is regenerated.
- **P1.10 Client-side compute (D1):** the UI runs the same engine in the browser: about 0.03 ms per 72-month forecast, 0.16 ms with sensitivity. The UI only calls `GET /api/network`, through one shared poller, and an e2e test enforces this. The privacy copy is updated to say so.
- **P1.11 Trailing growth default:** network growth defaults to the trailing 12-month rate clamped to 0–60%, shown as "trailing 12m: X%". That rate is −1.3% today, so the default is 0%.
- **Hydration fix:** the footer commit hash could differ between Next build workers, which caused intermittent React #418. It is now resolved once in `next.config.js`.
- **P1.12:** `ARCHITECTURE.md` and `tests/README.md` updated.

## Golden-fixture deltas (frozen market: BTC $84,700, 964 EH/s, tip 969,763, fees 0.027 BTC/block)
| Commit | What moved | Why |
|---|---|---|
| catalog single source | nothing | The TS copies were identical to the JSON |
| single cooling path | nothing | Default-climate derating is exactly 1.0 |
| MarketSnapshot + halvings by height | month-1 BTC/revenue **−22.20%** (all presets); 48-mo BTC −20.29%; the halving step moves from month 18 to inside month 19 | Live hashrate 964 EH/s replaces the 750 constant (750/964 − 1); block 1,050,000 is estimated from the tip instead of a 2028-04-01 date table |
| fees + 30.4375-day months | month-1 BTC/revenue **+2.33%**; OPEX +0.06% | (1 + 0.027/3.125) × 30.4375/30; electricity runs 730.5 h instead of 730 |
| price scenarios | inputs only (`fixed` → `flat`) | No number moves (last-bit float noise only) |
| forecast OPEX = dashboard OPEX | forecast month-1 OPEX: Home **+85.1%**, Garage +17.1%, Small Farm +11.2%, Industrial +3.7% | Maintenance labor (8 h × $35 for ≤20 miners; 30 + 0.2/miner + 1/fan h otherwise) now included |
| IRR null | `summary.irr` −99 → `null` | No discount rate repays CAPEX |
| API assumptions | `forecast.assumptions` added | Echo only |

**Cumulative vs P0:** month-1 revenue −20.38%, 48-month BTC −18.50%, CAPEX unchanged, dashboard OPEX +0.03–0.05%. All four presets lose money at today's market with the stale 2024 hardware prices. P2 refreshes the prices and presets.

## Verification
`pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`: all green (unit tests about 414, e2e 16).

## Needs you
- Same as P0: push the branches / open the PRs (no GitHub credentials in this environment).
