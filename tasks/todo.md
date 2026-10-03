# MineForge Revamp — Q4 2026 Execution Spec

> Written 2026-10-03 against commit `13068ae` (+ one uncommitted edit to `components/TemperatureControl.tsx`).
> Previous backlog/history: [`tasks/archive/2026-04-todo.md`](archive/2026-04-todo.md).
> Live site: https://www.bitcoinminingfarmcalculator.com (Vercel). ~500 views in the last 12 months.

---

## 0. Read this first (executing agent)

**Read order:** `../AGENTS.md` (workflow rules) → `../tasks/lessons.md` → this file top to bottom (including the appendices) → `ARCHITECTURE.md` (formulas).

**How to work this file**
- Every task has an ID (`P1.3`), a priority (**MUST** / **SHOULD** / **COULD**) and acceptance criteria. If time runs out, every MUST in a phase ships before any SHOULD.
- Tick `[x]` as you go. Add a one-line note under a task when you deviate, and say why.
- **Gates (🚦) are hard stops.** Present what the gate asks for, wait for the user's answer, and record that answer in §3 *Decision log* before continuing.
- Branch per phase from `main`: `revamp/p0-hygiene`, `revamp/p1-engine`, and so on. If the previous phase's PR is still waiting at G4, branch the next phase from *that* branch and rebase onto `main` after it merges. Don't sit idle waiting on a review.
- Use conventional commits (`fix:`, `feat:`, `refactor:`, `chore:`, `test:`), one commit per task where practical, and one PR per phase. Vercel gives each PR a preview URL, and the user reviews the preview before merge.
- **Each phase must be shippable on its own.** P0 + P1 + P2 together are a complete "credibility release" even if the visual revamp never lands.
- Line references (`file:line`) are as of `13068ae`. Expect drift once you edit, and re-grep before trusting a line number.
- Anything marked **⚠ re-verify** is dated research. Check it against the live source (npm, docs, manufacturer pages) at the moment you use it.
- Use subagents for research and for parallel exploration (AGENTS.md §2). Keep the main context for decisions and edits.

**Verification commands** (run before marking any phase done)
```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e            # added in P0.6
```

**Global Definition of Done (per phase)**
- [ ] lint, typecheck, unit tests, e2e and build all pass locally and in CI
- [ ] Golden-fixture diffs (P0.5) are either zero or every changed number is explained in the PR body
- [ ] The Vercel preview has been reviewed by the user
- [ ] The Review section (§9) is updated

---

## 1. Why we're doing this (context the user agreed on)

- This is a **portfolio piece**. It has never been promoted, so the 500 views say nothing about demand.
- The **shell** (generic light-SaaS UI) is ordinary. The **engine** is not:
  - Site-specific thermal sizing (map pin → ERA5 climate → derating → dry-cooler/fan count → CAPEX). None of Hashrate Index, Braiins, WhatToMine, NiceHash or ASIC Miner Value do this.
  - Electrical sizing (cable gauge, transformer tiers).
  - A 641-line `ARCHITECTURE.md` that documents every formula and its accuracy.
  - About 3.7k lines of vitest tests.
  - A documented, rate-limited public REST API with OpenAPI.
- What's hurting it now is **credibility**:
  - stale 2024 miner data with new-unit prices on obsolete hardware;
  - a forecast that ignores the live hashrate (≈+29% revenue overstatement);
  - a Stock-to-Flow option that projects ~$700k BTC today;
  - a red "loses money" banner as the first thing a visitor sees;
  - copy that contradicts the code ("No tracking", "Runs entirely in your browser").
- **The user's decisions:** fix credibility first, **do a full visual revamp with purposeful motion** so the engine finally looks as good as it is, and **add an MCP server** so AI agents can use the engine.

**Success criteria**
1. No number on the site is knowingly wrong or stale. Data freshness is visible in the UI.
2. A mining-literate visitor finds nothing that makes them stop trusting the tool. That means no S2F, current hardware, and realistic prices.
3. A non-expert visitor understands what the tool does within 10 seconds, and the first screen is not an error.
4. In 2–3 interactions a visitor sees something no competitor does: the live farm schematic plus the thermal pin-drop.
5. An agent can be pointed at `https://www.bitcoinminingfarmcalculator.com/api/mcp` and plan a farm end to end.
6. Lighthouse (mobile, on the preview): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO = 100.

---

## 2. Gates (🚦 stop and ask)

| Gate | When | What you present | What you need back |
|---|---|---|---|
| **G0** | Before any code | A short summary of this plan plus decisions D1–D8 (§3) with the recommendations | A pick or confirmation for each of D1–D8 |
| **G1** | End of P3 | 2–3 design directions as viewable mockups | One direction, plus tweaks |
| **G2** | P2.3, before writing `data/miners.json` | The full proposed miner and price table, with a source per row | Approval or corrections |
| **G3** | P5.9 | `server.json`, the namespace choice, and the auth steps | The user runs `mcp-publisher login …` themselves (needs DNS, GitHub or a private key) |
| **G4** | Every merge to `main` (which is a production deploy) | Preview URL and change summary | "Merge" |

---

## 3. Decisions (G0) and decision log

Present all of these together at G0. The recommendation comes first in each row.

| ID | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Where the UI computes results | **Client-side**, using the shared pure engine. Keep `/api/*` for external consumers and MCP. | The UI currently POSTs every change to `/api/calculate` and `/api/forecast` (`lib/apiClient.ts`, 200/400 ms debounce), and the Key Drivers box fires 4 more forecast calls. That makes "Runs entirely in your browser" false, and it adds latency that kills slider → metric motion. The engine (`lib/calculations.ts`, `lib/forecasting.ts`) is pure TS with no I/O, so it can run anywhere. The last commit deliberately added the backend API, so **ask, don't assume**. Alternative: keep server compute and fix the copy. |
| D2 | Price source for miners | **Manual curation**, with `price_source` + `price_as_of` per row, refreshed quarterly. Legacy units are priced from the efficiency-band $/TH index. | It's free and honest. The Hashrate Index API needs a paid plan ($52.50+/month). ASIC Miner Value's terms forbid scraping and business use. |
| D3 | Analytics | **Keep Vercel Analytics** and change the copy to "No accounts. No cookies. Anonymous page analytics only." | You need to measure whether the launch worked. The alternative is to remove `<Analytics/>`. |
| D4 | Canonical host | **`https://www.bitcoinminingfarmcalculator.com`**, with a permanent 308 redirect from the apex | That is what's live today. Right now the apex 307s to www, but the canonical, sitemap and `metadataBase` all point at the apex. |
| D5 | MCP registry namespace | **`com.bitcoinminingfarmcalculator/mineforge`** via HTTP well-known auth | It matches the product domain. The user keeps the ed25519 private key. Fallback: `io.github.<user>/mineforge` via GitHub login. |
| D6 | Product name | **"MineForge"** for the engine/API/MCP, with "Bitcoin Mining Farm Calculator" as the site title and SEO name. Header: "MineForge · Bitcoin Mining Farm Calculator". | The repo and package say MineForge but the site never does. Pick one story and use it everywhere. |
| D7 | Home and open-source miners | **Add them** (Bitaxe, NerdQAxe++, Avalon Nano 3S/Q/Mini 3), with a `segment: "home"` filter, and make the Home preset use one | The realistic audience includes hobbyists, and it widens SEO reach. |
| D8 | Stock-to-Flow | **Remove it entirely** (UI, engine, API enum, SeoContent, ARCHITECTURE.md). Replace with Flat / Annual growth % / Target price scenarios. | No serious miner trusts S2F, and it outputs ~$700k today and ~$5.6M after the 2028 halving. The API rejects the old enum values with a 400 that lists the valid ones (low traffic, so no compatibility burden). |

**Decision log** (fill in at G0 and the other gates)
- D1: Follow recommendation
- D2: Follow Recommentation
- D3: follow recommentation
- D4: follow recomendation
- D5: follow recomendation
- D6: follow recomendation
- D7: follow recomendation
- D8: follow recommendation
- G0 (2026-10-03): D1–D8 confirmed as recommended (see above). Execution started with no further pause.
- G1 direction: 
- G2 data approval: Do it automatically, this data can be reviewed
- G3 registry:

---

## 4. Traps (read before touching the engine)

1. **Two copies of the catalogs.** `lib/calculations.ts:2-3` imports `lib/dryCoolerData.ts` and `lib/airFanData.ts`, while the API serves `data/*.json` through `lib/serverData.ts`. Editing the JSON alone does not change any calculation. → P1.8 makes `data/*.json` the single source.
2. **Tests pin the bugs.** Two kinds, two treatments:
   - The hashrate and halving-date pins (`tests/forecasting.test.ts:6,221,352`, the April 2028 date) → **rewrite them to inject values.** Do not bump the constants.
   - The S2F pins (`:87-162`: 3.125 / 19.8e6 / the S2F formula) → **delete them**, since D8 removes those functions. Block-reward-from-height (P1.2) gets new tests instead.
3. **Cooling sizing exists three times:**
   - `lib/calculations.ts:265-306`: pure, with derating. **This one survives.**
   - `lib/store.ts:93-162` `autoConfigureCooling`: a private copy.
   - `components/TemperatureControl.tsx:73`: sizes dry coolers **without derating**.

   Auto-quantities differ depending on which path ran. Also, picking a location does **not** re-run auto-sizing, because `updateTemperature` never calls it.
4. **`validateForecastParams` is a whitelist** (`lib/validateFarmConfig.ts:184-190`). Any new `ForecastParams` field must be added there **and** to the route JSDoc (`app/api/forecast/route.ts`) so `next-openapi-gen` regenerates `public/openapi.json`. Otherwise the API silently drops the field.
5. **The rate limiter exempts every request without an `Origin` header** (`middleware.ts:52-53`). That means curl, scripts and every MCP client are unlimited, which contradicts `middleware.ts:9`, `README.md:39` and `next.openapi.json:97`. The subtlety: same-origin browser GETs also omit `Origin`, so "just remove the exemption" breaks the UI. → P0.8.
6. **Presets snapshot full miner objects** (`components/FarmPresets.tsx:12-29`). After the data refresh they would go stale. → P2.5 makes presets reference ids and resolve them from the catalog.
7. **Constants are duplicated:** 750 / 3.125 also appear in `components/FarmWarnings.tsx:10-11` and `components/MetricsDashboard.tsx:22-23`, and $90,000 in `components/ForecastCharts.tsx:133`.
8. **`generateForecast` reads the clock** (`new Date()` at `lib/forecasting.ts:38,159`), and the tests don't freeze time. → P1.1 injects `now`.
9. **The hidden 2×2 px `screenshot.png` in the hero** (`app/page.tsx:71-78`) is close to SEO cloaking. Delete it; don't carry it forward. Both `public/screenshot.png` and `docs/screenshot.png` are stale (they show a "Save Farm" button that no longer exists). Regenerate them in P6.
10. **The store is not persisted** (`lib/store.ts:164`, plain `create()`). A refresh loses the whole farm. There is no URL state.
11. **Recharts animates by default.** With debounced recalcs, charts re-animate on every input change. In the revamp, animate on first view only.
12. **The Leaflet marker icon loads from unpkg at runtime.** Replace it with an inline SVG `divIcon` (P4.8).
13. **`.openapi-gen/manifest.json` is tracked** and contains an absolute `/home/vscode/...` path.

---

## 5. Phases

Rough effort: P0 ½ day · P1 1½ days · P2 1 day plus review · P3 ½ day · P4 4–5 days · P5 1½ days · P6 ½ day · P7 ½ day.

### P0 — Baseline and hygiene (branch `revamp/p0-hygiene`)

- [x] **P0.1 MUST — Baseline.**
  - `pnpm install`, then run lint, typecheck, test and build, and record the results in §9.
  - Take screenshots of every tab at 1440 px and 390 px into `docs/case-study/before/`. The before/after story is portfolio material.
  - Run Lighthouse (mobile) on the production URL and record the scores in §9.
  - Note: PSI API was over quota (429), so Lighthouse ran locally (Lighthouse 13.5, mobile preset, Playwright Chromium). See `docs/case-study/before/README.md`.
- [x] **P0.2 MUST — pnpm everywhere.**
  - `git rm package-lock.json`.
  - CI (`.github/workflows/ci.yml`): use `pnpm/action-setup` and `pnpm install --frozen-lockfile`, cache pnpm, and **add a `pnpm typecheck` step** (currently missing).
  - Dockerfile: switch to corepack + pnpm.
  - Add `"packageManager": "pnpm@<version>"` to `package.json`.
  - Note: pinned `pnpm@12.5.1` (the local version). pnpm 12 rewrites `pnpm-lock.yaml` as a multi-document file and needs `pnpm-workspace.yaml` (`allowBuilds`). pnpm 10 self-switches to 12.5.1 via `packageManager`; pnpm 9 fails. If the Vercel install step fails, set `ENABLE_EXPERIMENTAL_COREPACK=1` in the Vercel project. Also set `outputFileTracingRoot` so a stray parent lockfile can't move the standalone root. Docker build not run locally (no Docker in the dev container).
- [x] **P0.3 MUST — Remove Supabase leftovers.** Delete `supabase/` and `.openapi-gen/manifest.json`, and add `.openapi-gen/` to `.gitignore` if it gets regenerated. Clean the Supabase variables out of `.env.example`, the mentions in `CONTRIBUTING.md:14,46`, the copy in `components/FarmPresets.tsx:10`, and the notes in `data/updates.json`.
  - Note: `.env.example` deleted entirely (no env vars are needed any more).
- [x] **P0.4 MUST — Make copy match the code.**
  - README: pnpm, Node 22, the real miner count, and drop the "regional presets US/BR/CN/EU" claim (only `CUSTOM` exists, `components/EnergyTab.tsx:58,113`).
  - Change "No tracking" per D3, and "Runs entirely in your browser" per D1 (fix the copy now; P1.10 may make it true again).
  - Remove dead code: `page.tsx:32 showMetrics`, unused `public/bg.jpg`, `public/bg.webp`, and the dead CSS `--primary-glow` and `.glass-card-hover`.
  - Remove the hidden hero `screenshot.png` (Trap 9).
  - Fix JSON-LD `Organization.logo` → `/logo.png`, which doesn't exist (`app/layout.tsx:175`): add the asset or point it at an existing icon.
- [x] **P0.5 MUST — Golden fixtures (the most important verification scaffold).**
  - Before any engine change, add `tests/golden/` with a script or test that runs `calculateFarmMetrics` and `generateForecast` for all 4 presets.
  - Use a frozen clock (`vi.useFakeTimers({ now: new Date('2026-10-03T00:00:00Z') })`).
  - Capture the engine **as it is now**. Pass `startingBtcPrice: 84700`, which is the only market input the engine accepts today. Hashrate is the hardcoded 750 by construction, so don't try to mock the `const` export.
  - P1.1 re-captures the fixtures with the injected snapshot (964 EH/s), and that PR body explains the delta (about −22% BTC mined in month 1).
  - Commit the outputs as JSON fixtures, and add a test that diffs current output against them.
  - From then on, every engine change that moves a number must update the fixture **and** explain the delta in the PR body (e.g. "month-1 BTC mined −22%: live hashrate replaces 750 constant").
- [x] **P0.6 SHOULD — Playwright smoke e2e** (`@playwright/test`, `pnpm test:e2e`), run in CI against `next build && next start`. Flows to cover:
  - load the page and see no console errors;
  - pick each preset and check that the metrics render;
  - visit every tab;
  - open the map modal and close it with Esc;
  - run all of the above at a 390 px viewport.

  Add `prefers-reduced-motion` and dark-mode projects later (in P4).
  - Note: each test sends its own `x-real-ip`, since the whole suite sharing one IP exhausts the new 600/min first-party bucket. Writing the suite also surfaced a UI bug: error bodies (429/400) were stored as data. Fixed with `fetchJson` (rejects non-2xx).
- [x] **P0.7 MUST — Remove placeholder illustrations.**
  - Commit the existing uncommitted `TemperatureControl.tsx` diff, which removes 4 `<CardIllustration>`.
  - Remove the remaining usages: `ForecastCharts.tsx:276`, `MetricsDashboard.tsx:143,166,221`, `LaborCosts.tsx:112,142,225`.
  - Remove the dead imports in MiningPoolParams, ImportTaxes, FarmBuilder, MinerSelector, EnergyTab, FarmPresets and TemperatureControl.
  - Delete `components/ui/CardIllustration.tsx` if nothing uses it any more.

  Why now rather than P4: the empty boxes look broken, and P0–P2 must be shippable on their own.
- [x] **P0.8 MUST — Fix the rate-limit exemption** (Trap 5). Prerequisite for P5.
  - Rate-limit **all** `/api/*` requests per IP.
  - Requests with `Sec-Fetch-Site: same-origin` get a higher bucket (e.g. 600/min, since the UI fires debounced bursts). Everything else gets 60/min.
  - Keep the 10k-IP cap. Document that the in-memory limiter is per serverless instance (best-effort).
  - Update `middleware.ts:9`, README and `next.openapi.json`.
  - Update `tests/middleware.test.ts`: a no-Origin request is now limited, and a same-origin GET without Origin is not falsely rejected.
- [x] **P0.9 MUST — SEO host fix (D4).**
  - Set `metadataBase` to www, so the canonical and the `app/sitemap.ts` URLs become www.
  - Ask the user to set the apex → www redirect to **permanent (308)** in Vercel Domains, since that's a dashboard action. Then check with `curl -sI https://bitcoinminingfarmcalculator.com`.
  - Note: one `SITE_URL` in `lib/site.ts`. Apex still answers **307** (checked 2026-10-03), so the user needs to switch it to 308 in Vercel → Domains.
- [x] **P0.10 SHOULD — OG image.** Remove the "Farm Visualizer" pill (that feature was removed) and the subtitle that repeats the title (`app/opengraph-image.tsx`). It gets fully redesigned in P4.

🚦 PR → preview → **G4**.

### P1 — Engine correctness (branch `revamp/p1-engine`)

Principle: **market state is an input, never a constant.** One `MarketSnapshot` type flows from `lib/networkData.ts` into the UI, the REST API, MCP and the tests.

- [ ] **P1.1 MUST — Introduce `MarketSnapshot` and inject it.**
  - Add `types/index.ts: MarketSnapshot { btcPriceUsd, networkHashrateEh, blockHeight, blockReward, avgFeesPerBlockBtc, asOf, isLive, sources }`.
  - `generateForecast(config, params, market, now = new Date())`.
  - Delete `CURRENT_NETWORK_HASHRATE_EH`, `CURRENT_DIFFICULTY` (if unused) and `CURRENT_BLOCK_REWARD` from `lib/forecasting.ts:7-9`, and their duplicates in `FarmWarnings.tsx:10-11` and `MetricsDashboard.tsx:22-23`.
  - Keep exactly **one** `FALLBACK_MARKET` in `lib/networkData.ts`, refreshed to Appendix C values, and label it in the UI as "offline estimate" whenever `isLive === false`.
  - Acceptance: grep finds no hardcoded 750, 964, 3.125 or 90000 outside `FALLBACK_MARKET` and the tests.
- [ ] **P1.2 MUST — Live chain data.** Extend `fetchNetworkData()`, which already uses mempool.space:
  - tip height: `GET https://mempool.space/api/blocks/tip/height`;
  - block reward derived from height (`50 / 2^floor(h/210000)`) instead of the fallback (`lib/networkData.ts:95`);
  - average fees per block: `GET https://mempool.space/api/v1/mining/reward-stats/144` (⚠ re-verify the response shape).

  Keep the 60 s server cache. **Fix `calcHashprice` in `lib/networkData.ts` to include `avgFeesPerBlock`.** Today it reports about $39.48/PH/day excluding fees, against Hashrate Index's $40.58 including fees. Otherwise P7.3's tolerance silently absorbs the gap.
- [ ] **P1.3 MUST — Halvings from block height.** Replace the hardcoded halving dates (`lib/forecasting.ts:12-17`) with `estimateHalvingDate(targetHeight, tipHeight, now, avgBlockMinutes = 10)`. The next halving is block 1,050,000, about 2028-04-13 (Appendix C). Drop the circulating-supply constant if S2F is gone (D8).
- [ ] **P1.4 MUST — Revenue accuracy.**
  - (a) Add transaction fees: revenue = (subsidy + avgFeesPerBlock) × share. Add a new `ForecastParams.feesPerBlockBtc` that defaults from the snapshot, and is editable in the UI ("Tx fees per block").
  - (b) Days per month = 30.4375, not 30 (`BLOCKS_PER_DAY * 30` in `calculateMonthlyRevenue`).
  - (c) Add an invariant test: month-1 gross USD revenue ≈ hashprice($/PH/day, *including fees*) × farm PH × 30.4375 × uptime × (1 − pool fee), within 0.5%.
- [ ] **P1.5 MUST — Price scenarios replace S2F (D8).**
  - `btcPriceModel: "flat" | "growth" | "target"`.
  - Params: `annualGrowthPercent` (growth) and `finalBtcPrice` (target). The start price is always `market.btcPriceUsd`, unless the user overrides it.
  - Remove `calculateStockToFlowPrice`, `getStockToFlowTarget`, `pessimisticAdjustPercent` and every S2F mention: UI (`ForecastCharts.tsx` ~:150-167, :361-368), `components/SeoContent.tsx`, the `ARCHITECTURE.md` S2F section, README and the JSON-LD/FAQ.
  - Optional UI chips: "Bear −30%/yr · Flat · Bull +30%/yr". Label them as **scenarios you choose, not predictions**.
- [ ] **P1.6 MUST — Update the API contract.**
  - `validateForecastParams` whitelist (Trap 4): add the new fields and remove the S2F ones. Old enum values return 400 `{ error, validValues }`.
  - `/api/forecast` and `/api/calculate`: if the client doesn't send market inputs, the **server fills them from the cached live snapshot**, and every response includes `assumptions: { market: MarketSnapshot, ... }` so consumers can see exactly what was used.
  - Update the route JSDoc → regenerate `public/openapi.json`, and update the `tests/api.*.test.ts`.
- [ ] **P1.7 MUST — Single cooling-sizing path** (Trap 3).
  - Extract `lib/cooling.ts` (pure): `sizeAirCooling(heatKw, climate, fans)` and `sizeHydroCooling(heatKw, climate, coolers)`, with derating applied. These return the recommended model, quantity, effective capacity, power and CAPEX.
  - `store.autoConfigureCooling` and `TemperatureControl.tsx` must both call it, with the private copies deleted.
  - `updateTemperature` must re-run auto-sizing, unless the user manually overrode the quantity (track a `quantityOverridden` flag).
  - Tests: the same inputs give the same quantity through every path, and a hot climate gives more coolers than a cold one.
- [ ] **P1.8 MUST — Single catalog source** (Trap 1). Make `data/*.json` canonical. The engine receives catalogs as arguments (or imports the JSON through one typed module, `lib/catalog.ts`). Delete `lib/dryCoolerData.ts` and `lib/airFanData.ts`, or generate them from the JSON. Add a test asserting that the engine and the API read the same objects.
- [ ] **P1.9 MUST — Investigate the OPEX in the default "loses money" case.** The old screenshot showed the Industrial preset (500 × S21 Hyd, 2.81 MW) at OPEX $231k/month vs revenue $157k.
  - Electricity at $0.05 is about $103k, maintenance 5%/yr of CAPEX is about $20k, and maintenance labor is about $4.5k. **That leaves ~$100k unexplained.**
  - Reproduce it with the current build, itemize it with a test that prints the `calculateMonthlyOpex` components, and either find the bug or document why it's correct.
  - Hypotheses to check: CAPEX inflated by hydro, dry-cooler, container or import-tax lines; tax adder; parasitic or cooling power counted twice. Record the finding in §9.
- [ ] **P1.10 SHOULD — Client-side compute (only if D1 = client).**
  - `useCalculation` and `useForecast` (`lib/apiClient.ts`) call the engine directly, synchronously, inside `useMemo`.
  - Key Drivers sensitivity: compute the 4 scenarios locally.
  - Network data still comes from `/api/network` (CORS on mempool.space plus caching).
  - Remove the debounce for calculations. If the forecast's 48-month loop ever exceeds about 8 ms, move it to `useDeferredValue` (measure first).
  - The API routes stay and are covered by tests.
- [ ] **P1.11 SHOULD — Trailing hashrate growth default.** Fetch the 1-year hashrate series (`mempool.space/api/v1/mining/hashrate/1y`), compute trailing 12-month growth, clamp it to 0–60%, and use it as the default `networkHashrateGrowthPercent`. Show "trailing 12m: X%" next to the slider. Keep the user override.
- [ ] **P1.12 MUST — Update `ARCHITECTURE.md`** for P1.1–P1.8: new revenue formula, scenarios, halving estimation, single cooling path, and an updated accuracy table.
- [ ] **P1.13 MUST (added during P0) — IRR when no root exists.** `calculateIrr` returns −99% whenever the cash flows can't recover CAPEX. When NPV has no sign change in the search range, return `null` ("n/a" in the UI, plus a test). This changes the `ForecastResult.summary.irr` type to `number | null`, which also touches the API docs.

🚦 PR → preview → **G4**. Golden-fixture deltas are explained in the PR body.

### P2 — Data refresh (branch `revamp/p2-data`)

- [ ] **P2.1 MUST — Miner schema v2.** The change is additive, so existing API consumers keep working. Keep every current field and add:
  ```ts
  cooling: "air" | "hydro" | "immersion"     // `watercooled` stays, derived = cooling !== "air"
  status: "current" | "legacy" | "announced"  // announced = not yet shipping; hidden by default in the UI
  segment: "industrial" | "home"
  price_basis: "new" | "used" | "index"       // how price_usd was obtained
  price_as_of: string                          // ISO date
  price_source: string                         // URL or "Luxor/TheBlock ASIC index band <x J/TH>"
  spec_source: string                          // URL to manufacturer/spec page
  ```
  - Update `types/index.ts`, `lib/validateFarmConfig.ts` (accept the new optional fields on client-sent miners), the `/api/miners` JSDoc and the OpenAPI spec.
  - Add `tests/data.miners.test.ts`: every row has all fields; `|power_watts / hash_rate_ths − efficiency_jth| / efficiency_jth < 3%`; ids are unique and URL-safe; `price_as_of` is no older than 120 days (this one is a **warning** test, so data ages visibly instead of breaking CI); `status = announced` implies it's excluded from presets.
- [ ] **P2.2 MUST — Build the proposed table** from Appendix B. Re-verify every spec against `spec_source` (⚠ the research is dated 2026-10-03).
  - Keep all current ids except the ones explicitly removed (CK5/CK6, see Appendix B). Only `s21-pro`, `s21-hyd` and `m60s` are referenced in code (`FarmPresets.tsx`), but external API consumers may use any id.
  - Mark pre-2023 units as `status: "legacy"` and price them as `index` or `used`.
  - **Pricing rules:**
    - **New / current units:** manufacturer shop or reseller price → `price_basis: "new"`.
    - **Legacy units:** $/TH from the Luxor/TheBlock ASIC price index band × TH/s → `price_basis: "index"`.
    - **Do not use the 14–19 J/TH band value ($3.63/TH on 2026-09-27).** It is anomalous: it sits below the 19–25 band and far below <14 at $18.38. For that tier, use reseller quotes or interpolate, and flag it in `price_source`.
  - Sanity reference: S19j Pro ≈ $120–320 and S19 XP ≈ $440–650 today, vs the $2,500 / $3,800 in the current JSON.
- [ ] 🚦 **P2.3 MUST — G2: present the full table to the user** (model, TH/s, W, J/TH, cooling, status, price, basis, as-of, source) **before** writing `data/miners.json`. Apply their corrections.
- [ ] **P2.4 MUST — Write the data.** Update `data/miners.json` and set `data/updates.json` to a real date and note (e.g. "Q4-2026 refresh: +N current-gen models, legacy repriced to market").
  - Surface freshness in the UI: "Hardware prices as of Oct 2026" near the miner selector, and in the footer.
  - Add a short "how to refresh prices" section to `CONTRIBUTING.md` or `data/README.md` (sources, rules, quarterly cadence).
- [ ] **P2.5 MUST — Presets reference ids** (Trap 6). Each preset stores `{ minerId, quantity, infrastructure, ... }` and resolves against the loaded catalog. New presets must be **profitable at the default $0.05/kWh** at today's market (check with the engine and add a test):
  - **Home:** 1 × Avalon Q (or Nano 3S, per D7), residential, no transformer;
  - **Garage:** 10 × S21 XP (air);
  - **Small Farm:** 100 × S21 XP or M70S (air, containers);
  - **Industrial:** 500 × S21 XP Hyd or S23 Hyd (hydro, containers).

  Note: if P1.9 found an OPEX bug, profitability depends on that fix.
- [ ] **P2.6 SHOULD — Gentler first impression.**
  - A fresh visit loads the "Small Farm" preset, not an empty or underwater farm.
  - `FarmWarnings` "OPEX > revenue" becomes an informative card ("At $X/kWh this farm loses $Y/month. Break-even power price: $Z/kWh"), not a red error banner. Keep red for real misconfigurations (undersized cooling).
- [ ] **P2.7 COULD — Refresh the dry-cooler and fan catalogs** (prices `as_of`) with the same provenance fields.

🚦 PR → preview → **G4**. This is the **credibility release**. Tag it `v1.1.0`.

### P3 — Design direction (no production code; branch `revamp/p3-design` for `docs/design/*`, or mockups in the scratchpad)

- [ ] **P3.1 MUST — Write the design brief** (½ page in `docs/design/brief.md`):
  - Audience: hiring managers / clients (portfolio) and miners (users).
  - Personality: precise, engineering-grade, trustworthy, alive with real data.
  - Non-goals: crypto-casino glow, ambient looping decoration, motion that doesn't explain something.
  - (Context: the project has already been through a "cyberpunk glassmorphism" phase and a light "blueprint glass" phase, see `tasks/archive/2026-04-todo.md`. Don't repeat either.)
- [ ] **P3.2 MUST — 2–3 directions as static HTML mockups**, each showing the hero, a metric card row, one chart, the farm schematic and the mobile layout. Publish them as a private Artifact or in `docs/design/` so the user can view them. Candidates:
  - **A. "Control Room" (recommended).**
    - Dark graphite (#0B0D10-ish) is the default, with a light "blueprint paper" mode.
    - Faint engineering grid; hairline 1 px rules.
    - **One** accent, Bitcoin orange `#F7931A`, reserved for live BTC/market data. Semantic hues for heat (amber→red), cooling (blue), money (green/red).
    - UI font: Geist or Inter Tight. Figures: Geist Mono / JetBrains Mono with `font-variant-numeric: tabular-nums`.
    - Feels like SCADA software for a real facility.
  - **B. "Engineering Datasheet".** Light, Swiss, print-like spec-sheet typography, dense tables, restrained motion. The most "B2B credible", the least showy.
  - **C. "Thermal".** Dark, with thermal-camera gradients as the visual language, tying everything to the cooling showcase. The most striking, with the highest risk of looking like a theme.
- [ ] 🚦 **P3.3 MUST — G1:** the user picks a direction. Record it in §3.

### P4 — Visual revamp and motion (branch `revamp/p4-ui`; split it into several PRs if it gets large)

**Motion principles (non-negotiable)**
1. **Motion explains cause and effect.** An input change → the outputs that changed animate (number roll plus a brief delta tint). Nothing animates without a state change behind it, except one subtle "live" pulse on the market ticker.
2. **Durations.** 120–200 ms for UI feedback, 250–400 ms for layout and tab transitions, 500–900 ms only for the showcase sequences (schematic, thermal). Springs for layout, ease-out for entrances.
3. **`prefers-reduced-motion`** → no movement: instant changes with at most opacity fades. Test this in a Playwright project.
4. **Never animate on every keystroke or slider tick.** Animate to the settled value; the number roll interpolates.
5. **No layout shift.** Reserve space, use tabular numerals, and set fixed chart heights.
6. **Charts** draw on first view only (`isAnimationActive` true on mount, false on recalcs).

**Stack:** `motion` (`motion/react`, the successor to framer-motion; ⚠ re-verify the package name and version), with `LazyMotion` + `domAnimation` + `m.*` components to keep the bundle small, plus CSS for simple transitions.

- [ ] **P4.1 MUST — Design tokens.**
  - CSS variables on `:root` for both themes; Tailwind maps to them; `darkMode: "class"`, defaulting to the system preference, with a theme toggle (old backlog item).
  - Remove the unused tokens (`blueprint-light`, `-grid`, the unused shadcn semantics, `glass-*`), the glass classes, and the hardcoded `color-scheme: light` (`globals.css:38`).
  - Chart colors come from tokens: no hex in `ForecastCharts.tsx`, and `getRoiColor` in `lib/utils.ts:104` is aligned with them.
  - Fonts via `next/font`.
- [ ] **P4.2 MUST — Primitives rebuilt and accessible.**
  - `Button` and `Card` via CVA (already installed).
  - **Tabs:** `role="tablist/tab/tabpanel"`, `aria-selected`, arrow-key navigation, and the active tab synced to `?tab=` for deep links. Animated indicator via `layoutId`.
  - **Dialog:** focus trap, focus return, Esc and click-outside.
  - **Tooltip:** `aria-describedby`, and tap-to-open on touch.
  - **Slider:** keyboard steps, plus a visible value with units.
  - **`<Metric>`:** a label, value and unit component with the number-roll + delta-tint behaviour from motion principle 1. Use it everywhere a figure appears.
- [ ] **P4.3 MUST — Information architecture and layout.**
  - **Hero:** a one-line value proposition, a live market strip, and **the live farm schematic** (P4.4), with a "Start from a preset" CTA.
  - **Workbench below:** tabs on the left/top, sticky results on the right. On mobile, results collapse into a sticky bottom summary bar (hashrate · MW · CAPEX · monthly profit) that expands as a sheet.
  - Remove the triple "About" duplication (tab, `#about-footer`, footer: `app/page.tsx:168-277`). Move About + methodology to `/methodology`.
  - `SeoContent` (`app/layout.tsx:195`, currently rendered under every tab) moves to `/methodology` and a slim home-page section.
- [ ] **P4.4 MUST — Signature 1: live farm schematic** (`components/FarmSchematic.tsx`, SVG, driven purely by `FarmMetrics` + config, deterministic, unit-testable layout function).
  - Shows: grid connection → transformer (labelled kVA) → PDUs → racks or containers, with fill proportional to miner count → cooling units (fans or dry coolers × qty) → heat exhaust.
  - **Power flow** animates along the paths, with speed or density scaled to MW.
  - **Heat plume** intensity scales with heat load and site climate.
  - Adding miners or changing cooling morphs the layout with layout animations.
  - Collapses gracefully for very large farms (e.g. "×12 containers" grouping).
  - Reduced motion: a static diagram.
  - This is the stop-scrolling moment. Polish it.
- [ ] **P4.5 MUST — Signature 2: the thermal pin-drop sequence.**
  - Map pick (plus a **search box** via Nominatim `search`; today you can only click a world map) → pin drops.
  - Climate card values count in → derating gauge sweeps → cooler/fan quantities recompute with a delta flash ("+3 dry coolers vs default climate") → CAPEX updates.
  - Depends on P1.7 (re-size on location change).
- [ ] **P4.6 MUST — Signature 3: Projections redesign.**
  - The hero metric is the **break-even BTC price**, shown against the live BTC price with a "you are here" marker and the margin of safety in %.
  - Then: payback month, IRR, NPV.
  - The cash-flow chart draws on first view.
  - Scenario chips (Bear / Flat / Bull / Custom) cross-fade the chart.
  - Key Drivers becomes a tornado chart.
  - The data table stays (monthly, quarterly, yearly).
- [ ] **P4.7 SHOULD — Miner comparison table** (new): every miner, with revenue/day, power cost/day and profit/day at *your* $/kWh, plus break-even $/kWh, $/TH and simple payback. Sortable; filter by segment, cooling and status. Uses the same `lib/unitEconomics.ts` as MCP `compare_miners` (P5.3). This is the most useful feature for real miners.
- [ ] **P4.8 MUST — Remaining tabs restyled** (Build, Energy, Deploy & Labor, Thermal):
  - token-based styling and the new primitives;
  - map tiles darkened in dark mode with a CSS filter (no new tile provider, so no new terms);
  - an inline SVG `divIcon` marker (no unpkg);
  - Leaflet attribution kept.
- [ ] **P4.9 SHOULD — Persistence and sharing.**
  - Zustand `persist` (localStorage, versioned with `migrate`, wrapped in try/catch).
  - "Copy share link": encode the config plus forecast params into `?s=` as base64url JSON (compress if it's over ~1.5 KB). Loading a link hydrates the store. Old backlog item.
- [ ] **P4.10 SHOULD — Global farm settings UI:** sliders for parasitic load %, uptime % and maintenance OPEX % (old backlog item), in the Build tab under "Advanced".
- [ ] **P4.11 MUST — OG image and favicon.** Redesign `app/opengraph-image.tsx` in the new direction, ideally showing a schematic snapshot. Optimize `public/favicon.svg` (117 KB → under 5 KB).
- [ ] **P4.12 MUST — Performance and accessibility pass.**
  - Lazy-load Leaflet (already done) and the Projections charts.
  - Keep the `motion` bundle lean.
  - Run Lighthouse on the preview to the §1 targets.
  - axe check via Playwright (`@axe-core/playwright`).
  - Playwright projects: light, dark, reduced-motion and mobile.
  - Keep the before/after screenshots in `docs/case-study/after/`.

🚦 PR(s) → preview → **G4**.

### P5 — MCP server (branch `revamp/p5-mcp`)

**Scope:** a public, read-only, **stateless** Streamable-HTTP server at `/api/mcp` on the same Vercel deployment. **Do not build:** auth, SSE, sessions, Redis, write tools, or a separate stdio package (a COULD at most, later).
**Rule:** tools call the **same pure engine** as the UI and REST, with zero duplicated math.

- [ ] **P5.1 MUST — Re-verify the stack** (⚠ Appendix D is research from 2026-10-03 and newer than the planning model's training):
  - `npm view mcp-handler version`, `npm view @modelcontextprotocol/server version`, `npm view zod version`;
  - read the `mcp-handler` README and the MCP spec versioning page.

  Expected (as researched): `mcp-handler@^2`, `@modelcontextprotocol/server@^2` (v2 line; `@modelcontextprotocol/sdk` 1.x is legacy), `zod@^4.2`, a single route file `app/api/mcp/route.ts` exporting the handler as GET and POST, and no Redis. If reality differs, follow reality and note the difference here.
- [ ] **P5.2 MUST — Shared domain layer for tools.**
  - `lib/defaults.ts`: move `defaultConfig` out of `lib/store.ts:34-87` so it's usable on the server.
  - `lib/farmSpec.ts`: a simplified agent-facing `FarmSpec`:
    - `{ miners: [{ id, quantity }], electricityPriceKwh, cooling?, infrastructure?, location?: { lat, lon }, climate?, poolFeePercent?, uptimePercent? }`
    - `buildFarmConfig(spec, catalog)`: resolves miner ids from the catalog, rejects unknown ids with suggestions, and applies defaults.
  - `lib/climate.ts`: move the Nominatim and Open-Meteo calls out of `components/LocationMapModal.tsx:50-100` so the client and server share them. Server-side requirements:
    - a descriptive `User-Agent` (Nominatim policy: max 1 req/s, identify your app);
    - cache by rounded lat/lon (0.1°) for 30 days in `serverCache`;
    - ⚠ check the Open-Meteo archive API terms for this usage.
- [ ] **P5.3 MUST — Tools.** All tools are read-only (`annotations: { readOnlyHint: true, openWorldHint: <true when it fetches external data> }`). Each has a zod `inputSchema` and an `outputSchema`, returns `structuredContent` plus a ≤5-line text summary, and **echoes the `assumptions` / market snapshot it used**.
  | Tool | Input | Output |
  |---|---|---|
  | `get_network_stats` | — | `MarketSnapshot` + hashprice $/PH/day (incl. fees) + next halving `{height, estimatedDate}` |
  | `list_miners` | filters: manufacturer, cooling, segment, status (default excludes `announced`), maxEfficiencyJth, minHashrateThs; `sortBy`; `limit` (default 20) | compact rows incl. price + `price_as_of` |
  | `get_miner` | `id` | full row incl. sources |
  | `compare_miners` | `electricityPriceKwh`, optional `minerIds` or filters, `poolFeePercent`, `uptimePercent` | per-miner revenue / cost / profit per day, break-even $/kWh, $/TH, simple payback (via new pure `lib/unitEconomics.ts`, shared with P4.7) |
  | `calculate_farm` | `FarmSpec` | `FarmMetrics` (CAPEX breakdown, OPEX, power, transformer kVA, cooling) + assumptions |
  | `forecast_farm` | `FarmSpec` + `{ months (12–72), priceScenario: {type: flat\|growth\|target, …}, networkHashrateGrowthPercent?, revenueMode?, discountRatePercent? }` | summary (payback, IRR, NPV, break-even BTC price) + **yearly** periods only (keep output small) + assumptions |
  | `size_cooling` | `{ location: {lat, lon} }` or `{ climate }`, plus `heatLoadKw` or `FarmSpec`, `cooling` | design temperature, derating, recommended model × qty, power, CAPEX |
  - Errors: return `isError: true` with an actionable message (e.g. "Unknown miner id 's21xp'. Did you mean 's21-xp'?"). Never throw raw errors.
- [ ] **P5.4 SHOULD — Resources:** `mineforge://catalog/miners` (JSON) and `mineforge://docs/methodology` (the `ARCHITECTURE.md` markdown).
- [ ] **P5.5 COULD — Prompt:** `plan_mining_farm(budgetUsd, electricityPriceKwh, location)`, which walks the agent through compare → calculate → size_cooling → forecast.
- [ ] **P5.6 MUST — Middleware and limits.** Confirm that `middleware.ts` (matcher `/api/:path*`) applies the P0.8 limiter to `/api/mcp` and doesn't break its method or headers. Return JSON-RPC-friendly 429s if the adapter allows it. Set `maxDuration` if needed (⚠ verify for v2).
- [ ] **P5.7 MUST — Tests.**
  - Unit-test each tool handler as a plain function: happy path, unknown id, out-of-range input, and the `assumptions` echo.
  - One integration test that POSTs JSON-RPC `tools/list` and `tools/call` (`calculate_farm` with a preset) against the route handler.
  - Golden check: `calculate_farm(Small Farm preset)` equals the UI engine output exactly.
- [ ] **P5.8 MUST — Manual verification with MCP Inspector** (⚠ re-verify the command):
  - `npx @modelcontextprotocol/inspector --cli http://localhost:3000/api/mcp --transport http --method tools/list`
  - Then a real client: `claude mcp add --transport http mineforge http://localhost:3000/api/mcp`. Ask Claude to "plan a 1 MW air-cooled farm in Paraguay at $0.04/kWh" and paste the transcript summary into §9.
- [ ] 🚦 **P5.9 MUST — Distribution (G3).**
  - Prepare `server.json` (registry schema ⚠ re-verify; researched as `2025-12-11`), with `remotes: [{ type: "streamable-http", url: "https://www.bitcoinminingfarmcalculator.com/api/mcp" }]` and the D5 namespace.
  - For HTTP auth: serve `/.well-known/mcp-registry-auth` with the **public** key only, and have the user generate the key pair and run `mcp-publisher login http` and `publish` themselves. **Never commit a private key.**
- [ ] **P5.10 MUST — `/mcp` page** ("Use MineForge from your AI agent"), styled in the new direction:
  - copy-paste snippets for Claude Code (`claude mcp add --transport http mineforge <url>`), claude.ai / Claude Desktop (Settings → Connectors → Add custom connector), Cursor (`.cursor/mcp.json`) and VS Code (`.vscode/mcp.json`) — see Appendix D;
  - the tool list (generated from the tool definitions, so it can't drift);
  - an example conversation.

  Link it from the header, `/api-docs`, the README and the sitemap.
- [ ] **P5.11 SHOULD — `public/llms.txt`** (llmstxt.org format): H1 title, a blockquote summary, and H2 sections linking `/methodology`, `/api-docs`, `/openapi.json`, `/mcp`, and the MCP endpoint.

🚦 PR → preview → **G4**.

### P6 — Launch and portfolio packaging (branch `revamp/p6-launch`)

- [ ] **P6.1 MUST — Rewrite the README** to lead with the engine: thermal sizing, electrical sizing, a tested engine shared by UI + REST + MCP, and the methodology doc. Include a hero GIF/video, the MCP quick-start and the API table. Move the tech stack down.
- [ ] **P6.2 MUST — Demo assets.** Regenerate `public/screenshot.png` and `docs/screenshot.png` (Trap 9). Record a 30-second clip:
  - preset → schematic morphs;
  - pin in Texas vs Norway → cooler count changes;
  - Projections break-even vs live price.

  Store it as an optimized MP4/WebM plus a GIF for the README.
- [ ] **P6.3 SHOULD — Case study** `docs/case-study.md`: before/after screenshots (P0.1, P4.12), the credibility bugs found and fixed (hashrate constant, S2F, OPEX finding, rate limiter), and the architecture decisions (D1, the MCP design). This is the portfolio narrative.
- [ ] **P6.4 MUST — SEO.**
  - The sitemap includes `/`, `/methodology`, `/mcp`, `/api-docs`.
  - Per-page metadata.
  - JSON-LD updated: S2F removed; the FAQ matches the new content.
  - Validate with Google's Rich Results test, and ask the user to submit the sitemap in Search Console.
- [ ] **P6.5 SHOULD — Launch drafts** in `tasks/launch/`. **The user posts these; the agent only drafts them.**
  - r/BitcoinMining: lead with thermal sizing plus the free tool; be explicit that prices are as of Oct 2026.
  - Show HN: lead with "a mining farm planner your AI agent can call via MCP".
  - X / Nostr thread.
  - MCP directories (official registry via G3, plus PRs to awesome-mcp-servers lists).
  - LinkedIn post for the portfolio audience.

### P7 — Final verification and review

- [ ] **P7.1 MUST** Full Definition of Done on `main` after the last merge: lint, typecheck, unit, e2e and build all pass, and CI is green.
- [ ] **P7.2 MUST** Production smoke:
  - `curl -s https://www.bitcoinminingfarmcalculator.com/api/network` (live, with fees and height);
  - `/api/mcp` `tools/list` via the Inspector CLI;
  - the apex returns 308 → www;
  - `/llms.txt`, `/sitemap.xml` and the canonical tag are correct.
- [ ] **P7.3 MUST** Cross-check: for 1 × S21 XP at $0.05/kWh, compare the site's day-1 revenue with Hashrate Index hashprice × 0.27 PH. They should agree within ±3%. Record it in §9.
- [ ] **P7.4 MUST** Lighthouse scores vs the §1 targets; record them in §9.
- [ ] **P7.5 MUST** Update `../tasks/lessons.md` with anything learned, and fill in §9.

---

## 6. Later / out of scope (parked from the old backlog)
- Multi-currency (OPEX in local currency, revenue in USD).
- Electrical config UI (cable gauge, length, copper price inputs).
- Cooling config UI (air vs hydro selector and cost inputs). Partly covered by the P4 restyle; build it if trivial.
- Showing the payout scheme name in the forecast summary.
- An automated price-refresh job (only if D2 changes to a paid API).
- A stdio MCP package (`npx mineforge-mcp`) for offline use.

---

## 7. Appendix A — Codebase map (as of `13068ae`)

**Stack:** Next.js 15 App Router, React 19, TS, Tailwind 3, Zustand 5, Recharts 2, Leaflet/react-leaflet 5, lucide-react, vitest 3, `next-openapi-gen`, `@vercel/analytics`. No animation library. pnpm lockfile, but CI and Docker still use npm.

**Engine (pure)**
- `lib/calculations.ts`: almost every export is `(config: FarmConfig) => number`. `calculateFarmMetrics(config) → FarmMetrics` (23 fields) at about line 419. `calculateMonthlyOpex(config, totalCapex)` is at :395-414: electricity, plus maintenance (`maintenanceOpexPercent`, annual ÷ 12, :405), plus solar maintenance, plus maintenance labor (:375-390: ≤20 miners → 8 h; otherwise 30 + 0.2·miners + 1·fans hours, × $35).
  - Cooling math: `calculateVentilation` :265-283, `getDryCoolerDeratingFactor` :292-301, `calculateEffectiveDryCoolerCapacityKw` :306, default climate :15-23.
- `lib/forecasting.ts`:
  - Constants: 750 EH/s :7, difficulty 108e12 :8, reward 3.125 :9, halvings :12-17, supply 19.8e6 :27, S2F 0.4·SF³ :29, $10k floor :31.
  - `calculateMonthlyRevenue` (~:80-110): 30-day months, no tx fees.
  - `generateForecast` (~:155-317): hardcoded hashrate at :170 and :188, linear price interpolation, $500 maintenance fallback at :217.
- `types/index.ts`: `Miner` :65, `FarmConfig` :143, `FarmMetrics` :162, `ForecastParams` :189 (no hashrate field), `ForecastResult` :219.

**Data**
- `data/miners.json`: 50 models, 13 fields, newest 2024.
- `data/dryCoolers.json`: 26 models. `data/airFans.json`: 3 models.
- `data/updates.json`.
- The engine reads the TS copies `lib/dryCoolerData.ts` and `lib/airFanData.ts` instead (Trap 1).
- `lib/serverData.ts:25` reads the JSON with `fs` and caches it in the module.

**Network**
- `lib/networkData.ts`: mempool.space `/api/v1/prices` and `/api/v1/mining/hashrate/1m`, with CoinGecko as a price fallback (:45-93). Fallback values at :19-22. Block reward is never fetched live (:95).
- `lib/serverCache.ts`: in-memory with in-flight de-duplication. `/api/network` caches for 60 s.
- Client hook `useNetworkData` (`lib/apiClient.ts:193`) polls every 5 min and isn't stored in Zustand.
- The forecast UI replaces the $90k default with the live price (`ForecastCharts.tsx:143-147`), but never passes hashrate.

**API**
- GET `/api/miners | dry-coolers | air-fans | updates` (10-minute cache) and `/api/network`.
- POST `/api/calculate`: 256 KB limit, `validateFarmConfig`, 8 calc functions.
- POST `/api/forecast` with `{config, params}`.
- Validation is shape-only, and miners sent by the client are not checked against the catalog. Limits: 1,000 entries, 1M units.
- `middleware.ts`: in-memory per-IP sliding window, 60/min, 10k-IP cap, IP from `x-real-ip` or the last XFF hop. **No-Origin requests are exempt (:52-53).**
- `lib/cors.ts` reflects the Origin.
- OpenAPI is generated from route JSDoc (`next.openapi.json`) into `public/openapi.json` (tracked). `/api-docs` serves Scalar 1.52.1 from jsDelivr with SRI and a CSP.

**UI**
- `app/page.tsx`:
  - Layout: NetworkStatsBanner, then a sticky header, then the hero (:61-70), then the hidden screenshot (:71-78).
  - Tabs: `useState` (:22), no URL sync, buttons at :84-106, `animate-fade-in` on switch (:112).
  - The build, energy, labor and thermal tabs use `lg:grid-cols-3` with `MetricsDashboard` repeated in the right column. Forecast is full width. About is inline (:168-259), and again at :265 and :271.
  - The footer shows commit hash and date (:275-277, from `next.config.js:23`).
- Component sizes (lines): ForecastCharts 785, TemperatureControl 602, MetricsDashboard 485, LaborCosts 302, EnergyTab 298, LocationMapModal 288, SeoContent 283, FarmBuilder 238, FarmPresets 155, FarmWarnings 131, MinerSelector 98, MiningPoolParams 85, NetworkStatsBanner 78, ImportTaxes 43.
- `components/ui/`: Button (`cn`, not CVA), Card (`glass-card p-7`), Input, Slider, Tooltip (no `aria-describedby`, no touch), CardIllustration (10 inline-SVG themes, to be removed in P0.7).
- Styling:
  - `tailwind.config.ts`: `blueprint.{deep #1E40AF, mid, light, faint, grid}`, shadcn semantics (unused), glass radius/shadow/blur (unused), Inter via `--font-inter`, no keyframes or plugins.
  - `globals.css`: CSS variables :6-30, `.glass-*` classes, `color-scheme: light` :38, reduced-motion only gates `scroll-behavior` :189, keyframes `fadeInUp` / `fadeInScale` :195-223.
- Charts:
  - MetricsDashboard: CAPEX donut with a 12-color `PIE_COLORS` array (:126).
  - ForecastCharts: 2 LineCharts and 2 ComposedCharts with hardcoded hex colors; `TOOLTIP_STYLE` :33-41; KPI rows :474 and :521; Key Drivers :761-781, fed by 4 extra `/api/forecast` calls (:176-235).
- Thermal flow:
  - Thermal tab → "Choose Location" (`TemperatureControl.tsx:162`).
  - Portal modal (`LocationMapModal`, dynamic `ssr:false`), OSM tiles, unpkg marker.
  - Click only, no search.
  - Nominatim reverse geocode and the Open-Meteo ERA5 archive (previous calendar year) run client-side (:50-100).
  - The result shows as 5 editable inputs → Confirm.
  - The cards show rated vs effective capacity with derating (`TemperatureControl.tsx:555-561`).
- A11y: tabs have no ARIA roles; the modal has `role=dialog` and `aria-modal` but no focus trap.
- Store: `lib/store.ts`, plain `create()` with no persistence. `defaultConfig` :34-87 (CUSTOM region, $0.05/kWh, air, maintenance 5%, $35/h). `autoConfigureCooling` :93-162 runs only on miner or catalog changes (:176-211).
- Presets (`FarmPresets.tsx:12-29`): Home s21-pro×2 racks, Garage s21-pro×10 racks, Small s21-pro×100 containers, Industrial s21-hyd×500 containers.

**SEO**
- `app/layout.tsx`:
  - `metadataBase` is the apex.
  - JSON-LD `@graph` (SoftwareApplication, FAQPage, Organization), whose `logo.png` is missing.
  - `SeoContent` sits after `{children}` (:195).
  - `<Analytics/>` :196.
- `app/sitemap.ts`: `/` and `/api-docs` (apex). `app/robots.ts` disallows `/api/`.
- **Live:** the apex returns **307** to www, and the canonical is `https://bitcoinminingfarmcalculator.com` (apex).

**Tests and CI**
- `tests/` has about 3.7k lines across calculations, forecasting, api.calculate, api.forecast, api.catalog, api.docs, middleware, cors, serverCache, store, utils and validateFarmConfig. Node environment, `@` alias.
- No e2e tests.
- CI: Node 22, `npm ci`, then lint, test, build. **No typecheck.**

**Hygiene**
- Tracked but stale: `supabase/schema.sql`, `package-lock.json`, `.openapi-gen/manifest.json`, the Supabase variables in `.env.example`.
- Ignored correctly: `.DS_Store`, `*.tsbuildinfo`, `next-env.d.ts`.
- Docker: `node:22-alpine`, `npm ci`, standalone output.

---

## 8. Appendices B–E — Research snapshot (2026-10-03, ⚠ re-verify before use)

### Appendix B — ASIC candidates for the refresh

Key: A = air, H = hydro, I = immersion; a = announced, s = shipping, l = first listed; 2° = secondary source only. `*` = watts computed from TH/s × J/TH.

| Model | TH/s | W | J/TH | Cool | Date | Source |
|---|---|---|---|---|---|---|
| S21+ / S21+ Hyd | 216 / 358 | 3564 / 5370 | 16.5 / 15 | A / H | l 1/25 · s Q2/25 | hashrateindex.com/rigs/bitmain-antminer-s21+ (2°) · shop.bitmain.com/product/detail?pid=00020250403133023342huPDNmi506AF |
| S21 XP / XP Hyd | 270 / 473 | 3645 / 5676 | 13.5 / 12 | A / H | s 12/24 | support.bitmain.com/hc/en-us/articles/35383015643673-S21-XP-Specifications · …/34523540504857-S21-XP-Hyd-Specification |
| S23 | 318 | 3498 | 11 | A | a 5/25 | hashrateindex.com/rigs/antminer-s23 (2°) |
| S23 Hyd / Hyd 3U | 580 / 1160 | 5510 / 11020 | 9.5 | H | s Q1/26 · l 12/25 | hashrateindex.com/rigs/antminer-s23-hydro · /rigs/u3s23h (2°) |
| S23 Imm (2 bins) | 368 / 442 | 4048 / 5304 | 11 / 12 | I | 5/25, 1/26 | hashrateindex.com/rigs/antminer-s23-immersion (2°) |
| S23e Hyd 2U | 865 | 8650 | 10 | H | a 1/26 | shop.bitmain.com/product/detail?pid=000202601010841411189UJk1mK10645 |
| S23 XP Hyd | 600 | 5340 | 8.9 | H | a 8/26 · s 11/26 → `announced` | shop.bitmain.com/product/detail?pid=000202608201636197889T3Y4SxC0660 |
| S21 XP+ Hyd / S21j XP Hyd / S21e XP Hyd | 480 / 495 / 430 | — | 11 / 12 / 13 | H | 2026 | shop-product-service.bitmain.com/api/productshow/getMainProductsWithFilter?language=en |
| M60S++ / M63S++ / M66S++ | 218 / 464 / 356 | 3379 / 7192 / 5518 | 15.5 | A / H / I | a 12/24 | shop.whatsminer.com/products/details/74?skuId=169 · /75?skuId=170 · hashrateindex.com/rigs/microbt-whatsminer-m66s++ (2°) |
| M70S / M73 | 248 / 512 | 3348 / 7424 | 13.5 / 14.5 | A / H | a 12/25, in stock | shop.whatsminer.com/products/details/79?skuId=190 · /80?skuId=191 (M70S listed at $3,224 ≈ $13/TH) |
| M73S+ / M76S+ | ≤600 / ≤440 | ~7500* / ~5500* | 12.5 | H / I | a 12/25, shipping UNVERIFIED | hashrateindex.com/blog/microbt-reveals-the-whatsminer-m70-series/ (2°) |
| Avalon A15 / A15 Pro | 194 / 218 | 3647 / 3662 | 18.8 / 16.8 | A | a 11/24 | asicminervalue.com/miners/canaan/a15-194t · /a15pro-218t (2°) |
| Avalon A16 / A16XP | 282 / 300 | 3900 / 3850 | 13.8 / 12.8 | A | a 10/25; XP s Q2/26 | hashrateindex.com/blog/canaan-unveils-the-avalon-a16-series/ (2°) · sec.gov/Archives/edgar/data/0001780652/000110465925103380/tm2529626d1_ex99-1.htm |
| Avalon Nano 3 / 3S (home) | 4 / 6 | 140 | 35 / 23.3 | A | 2024 / 1/25 | hashrateindex.com/blog/canaan-avalon-nano-3-… · …-nano-3s-… (2°) |
| Avalon Mini 3 / Avalon Q (home) | 37.5 / 90 | 800 / 1674 | 21.3 / 18.6 | A | 1/25 / 2/25 | hashrateindex.com/blog/canaan-avalon-mini-3-… · /rigs/avalon-q (2°) |
| SealMiner A2 | 226 | 3729 | 16.5 | A | s 3/25 | bitdeer.com/shop/product/P241127000001 |
| SealMiner A2 Pro Air / Hyd | 270 / 530 | ~4020* / ~7900* | 14.9 | A / H | a 3/25 | sec.gov/Archives/edgar/data/1899123/000114036125013247/ef20046998_ex99-1.htm |
| SealMiner A3 Pro Air / Hyd | 290 / 660 | ≤4000 / ≤8625 | 12.5 | A / H | a 9/25, s Q4/25 | globenewswire.com/news-release/2025/09/16/3150958 · bitdeer.com/shop/sealminer/a3 |
| SealMiner A4 Pro Air / Hyd | 336 / 680 | 3662 / 7412 | 10.9 | A / H | a 4/26, shipping UNVERIFIED → `announced` | globenewswire.com/news-release/2026/04/07/3269133 |
| Teraflux AT2880 / AH3880 | 260 / 600 | UNVERIFIED / ~8700* | 16 / 14.5 | A / H | 11/23 · 3/25 | globenewswire.com/news-release/2023/11/14/2780158 · crypto-reporter.com (2°). Auradine is now Velaura AI, with no new models: probably skip. |
| Block Proto Rig | ≤819 | ≤12000 | 14.65 | A | a 8/25, shipping UNVERIFIED; Core Scientific deal reportedly cancelled → `announced` or skip | proto.xyz/products/rig |
| Bitaxe Gamma / Supra / GT (home) | 1.2 / 0.6 / 2.15 | 17 / 14 / 43 | ~14 / ~23 / ~20 | A | 1/25, 1/25, 1/26 | github.com/bitaxeorg/bitaxeGamma · /bitaxeSupra · /bitaxeGT (2°) |
| NerdQAxe++ (home) | 4.8 | 76 | 15.8 | A | 10/24 | github.com/shufps/qaxe |

Notes:
- Shops sell lower hashrate bins than press releases quote, and Bitdeer allows ±10%. Use the bin you actually price.
- Not found (UNVERIFIED): S23 Pro, S25, M80, A17.
- The current JSON lists Goldshell CK5/CK6 as `"algorithm": "SHA-256"`. To the planning model's knowledge, the Goldshell CK series are **Eaglesong (Nervos CKB) miners, which cannot mine Bitcoin**. Verify, then **remove them**: a mining-literate visitor would spot this at once. The Antminer S9 ($200, 98 J/TH) stays as `legacy`, only if it's useful as a "what not to buy" reference.

**Price references**

Luxor ASIC price index via The Block, 2026-09-27 (theblock.co/data/on-chain-metrics/bitcoin/bitcoin-asic-price-index):

| Efficiency band | $/TH |
|---|---|
| <14 J/TH | $18.38 |
| 14–19 J/TH | $3.63 (**anomalous: do not use**) |
| 19–25 J/TH | $3.14 |
| 25–38 J/TH | $1.18 |

- **New units:** S21+ about $6.47/TH and S21 XP from about $11/TH (miningnow.com); Whatsminer M70S $3,224.
- **Used:** S19j Pro 104T about $123 implied by the index ($320+ in listings); S19 XP 141T about $443 implied by the index (dealers from $649).
- **Sources and terms:**
  - Hashrate Index API (`GET /asic/price-index`, `X-Hi-Api-Key`, paid $52.50–$3,000/month; docs.luxor.tech/hashrateindex/api/asic/get-asic-price-index).
  - ASIC Miner Value: terms forbid scraping and business use.
  - Kaboomracks: Telegram only.
  - Compass: no API.

### Appendix C — Market snapshot (2026-10-03)
- BTC **$84,714** (mempool.space). Our live `/api/network` showed $84,587.
- Hashrate **964 EH/s**; 7-day average 952 EH/s on 2026-09-28.
- Hashprice **≈ $40.58/PH/day** including fees (hashrateindex.com). Our `/api/network` reports $39.48, which excludes fees.
- Next halving: block **1,050,000**, about **2028-04-13** (computed from block ~969,763 at 10 min/block; NiceHash says 2028-04-10).
- **Sanity formula:** BTC/day for a farm = `farmTH / (networkEH × 1e6) × 144 × (subsidy + feesPerBlock)`. Then USD/day = BTC/day × price, and hashprice $/PH/day = USD/day per PH.

### Appendix D — MCP tooling (researched 2026-10-03; newer than the planning model's training, so re-verify in P5.1)
- **Spec revision 2026-07-28:**
  - Stateless: no `initialize` handshake, no `Mcp-Session-Id`.
  - New `server/discover` method.
  - Deprecates Logging, Sampling, Roots and Dynamic Client Registration.
  - Source: modelcontextprotocol.io/specification/versioning
- **TS server:**
  - `@modelcontextprotocol/server` 2.x (v2 shipped 2026-07-27). `@modelcontextprotocol/sdk` 1.x is legacy.
  - API: `registerTool(name, { description, inputSchema: z.object(...) }, cb)`. Needs `zod ^4.2`.
  - Source: github.com/modelcontextprotocol/typescript-sdk
- **Vercel adapter:**
  - `mcp-handler` 2.x (replaces `@vercel/mcp-adapter`). `createMcpHandler`.
  - Route `app/api/mcp/route.ts`: `export { handler as GET, handler as POST }`.
  - 2.x dropped the `[transport]` dynamic route, SSE and Redis. Node 20+, `next >=13`.
  - `withMcpAuth` exists (not needed here).
  - Sources: github.com/vercel/mcp-handler · vercel.com/docs/mcp/deploy-mcp-servers-to-vercel
- **Registry (preview):**
  - `mcp-publisher init`, then `login {github|dns|http}`, then `publish`.
  - `server.json` schema `2025-12-11` with `"remotes":[{"type":"streamable-http","url":"…"}]`.
  - `login http` serves `v=MCPv1; k=ed25519; p=<pubkey>` at `/.well-known/mcp-registry-auth`. `login dns` uses a TXT record with the same string. `login github` gives the `io.github.<user>/*` namespace.
  - Source: github.com/modelcontextprotocol/registry/tree/main/docs
- **Client snippets:**
  - Claude Code: `claude mcp add --transport http mineforge https://www.bitcoinminingfarmcalculator.com/api/mcp` (or `.mcp.json` `{"mcpServers":{"mineforge":{"type":"http","url":"…"}}}`), code.claude.com/docs/en/mcp
  - claude.ai / Claude Desktop: Settings/Customize → Connectors → Add custom connector → URL, support.claude.com/en/articles/11175166
  - Cursor: `.cursor/mcp.json` `{"mcpServers":{"mineforge":{"url":"…"}}}`. Deeplink `cursor://anysphere.cursor-deeplink/mcp/install?name=…&config=<base64>` (UNVERIFIED for URL configs).
  - VS Code: `.vscode/mcp.json` `{"servers":{"mineforge":{"type":"http","url":"…"}}}`
- **Inspector:**
  - `npx @modelcontextprotocol/inspector --server-url <url> --transport http` (web UI).
  - CLI: `npx @modelcontextprotocol/inspector --cli <url> --transport http --method tools/list`.
  - Needs Node ≥ 22.19.
- **llms.txt:** llmstxt.org. A Markdown file with an H1, a blockquote summary, H2 sections of links, and an optional "Optional" section.

### Appendix E — Second-opinion notes (Fable, 2026-10-03)
- The S2F button is opt-in (the default is `btcPriceModel: "fixed"`, `ForecastCharts.tsx:128`), but clicking it destroys trust.
- The "loses money" banner is honest math (guarded by `btcPriceUsd > 0`, `FarmWarnings.tsx:81`), not a fetch artifact. It's a first-impression problem.
- Lead the portfolio with `ARCHITECTURE.md`, the thermal pipeline and the tested, agent-callable engine, not the framework list.

---

## 9. Review (fill in as phases complete)

### Baseline (P0.1)
- Tests / typecheck / lint / build (2026-10-03, `13068ae`): lint ✔ · typecheck ✔ · 352/352 vitest ✔ · build ✔ (`/` 166 kB, first load 269 kB). Before the P0 changes there were no e2e tests.
- Lighthouse (prod, mobile; local Lighthouse 13.5 because PSI was over quota) Perf / A11y / BP / SEO: **99 / 91 / 100 / 100**. A11y failures: 6 unlabeled range sliders, and the contrast of the active-tab number (4.2:1).

### Findings
- P1.9 OPEX investigation:
- Golden-fixture deltas per phase:
  - P0: fixtures captured (none moved). Engine-as-is month 1 at $84,700 / 750 EH/s: Small Farm revenue $33,704 vs OPEX $18,024 (from metrics); Industrial revenue $241,254 vs OPEX $128,109.
- IRR bug (found during P0.1): every preset reports IRR **−99.0%**, even with positive net profit. Undiscounted cash flows never recover CAPEX, so there is no root in the bisection range and it drifts to the lower bound. → P1.13.

### Verification
- P5.8 real-client MCP transcript summary:
- P7.3 revenue cross-check vs Hashrate Index:
- P7.4 Lighthouse (final):

### Retrospective
-
