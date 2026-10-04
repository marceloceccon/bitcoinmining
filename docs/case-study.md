# Case study: MineForge, from a calculator to an engine agents can call

MineForge (Bitcoin Mining Farm Calculator) plans a mining operation from a single home unit to an industrial site. Its engine already did things no competitor did: site-specific thermal sizing, electrical sizing and a documented formula set. Its shell and its credibility didn't match. This revamp fixed the credibility first, gave the engine a face, and opened it to AI agents.

| | Before (Oct 2026, `13068ae`) | After |
|---|---|---|
| First screen | Empty farm, red "loses money" banner on load | Live farm schematic of a profitable Small Farm preset |
| Market data | Hashrate hardcoded at 750 EH/s; no fees; halvings from a date table | Live snapshot (hashrate, tip height, fees) with a labelled offline fallback |
| BTC price | Stock-to-Flow option (~$700k "today") | Flat / ±% per year / target scenarios, labelled as choices |
| Hardware | 50 rows from 2024, new-unit prices on obsolete units, two non-Bitcoin miners | 90 rows with sourced, dated prices; legacy units priced from the Luxor index |
| Compute | Every input change POSTed to the API (+4 for Key Drivers) | Same engine in the browser; the UI only fetches the market snapshot |
| Agents | REST only | MCP server with 7 read-only tools, `/mcp` page, registry-ready |
| Lighthouse (mobile) | 99 / 91 / 100 / 100 | 98 / 100 / 96* / 100 |

<sub>*Local run; the only Best Practices failure is the Vercel Analytics script, which 404s off Vercel.</sub>

Screenshots: [`docs/case-study/before/`](case-study/before/) and [`docs/case-study/after/`](case-study/after/). Demo: [`docs/media/demo.mp4`](media/demo.mp4).

## The credibility bugs

Each finding was pinned by a **golden fixture** before the engine changed: the four presets run through the engine with a frozen clock and market, and every number is diffed. Every later commit that moved a number explained it.

1. **The hashrate constant.** Revenue used a hardcoded 750 EH/s while the network ran at ~964 EH/s, overstating month-1 revenue by about 29% (golden delta −22.2%). Market state became an input: one `MarketSnapshot` flows from `lib/networkData.ts` into the UI, REST, MCP and tests, and no 750/964/3.125 literal survives outside the dated fallback.
2. **No transaction fees, 30-day months.** Revenue now counts fees (~0.027 BTC/block) and uses 30.4375-day months for both revenue and electricity. An invariant test ties month-1 revenue to hashprice including fees within 0.5%.
3. **Halvings from a date table.** Halvings now come from block height; the month containing block 1,050,000 gets a block-weighted subsidy.
4. **Stock-to-Flow.** Removed from the engine, API (old values return 400 with the valid ones), UI, SEO copy and docs.
5. **The "unexplained $100k of OPEX".** An old screenshot showed the Industrial preset at $231k/month OPEX. Itemizing it with a test showed every dollar accounted for at the current build ($102,781 electricity + $20,848 maintenance + $4,550 labor = $128,179). The investigation found a real bug instead: **the forecast's OPEX left out maintenance labor**, so Projections and the dashboard disagreed (Home preset +85%). Both now share one itemized OPEX.
6. **IRR −99%.** Every preset reported −99.0% next to a positive profit: bisection ran even when NPV never changed sign. IRR is now `null` ("n/a") when no rate repays the CAPEX. A sibling bug, **payback never triggering in the default revenue mode**, was found while documenting it.
7. **The rate limiter.** Requests without an `Origin` header (curl, scripts, every MCP client) were unlimited. Now every request is limited per IP, with a higher first-party bucket detected via `Sec-Fetch-Site`.
8. **Copy that contradicted the code.** "Runs entirely in your browser" was false (every calculation hit the API) until client-side compute made it true again; "No tracking" sat next to Vercel Analytics.
9. **Data.** Goldshell CK5/CK6 are Eaglesong (Nervos CKB) miners listed as SHA-256; "S21 Ultra" and "AvalonMiner 1346 Pro" don't exist. Removed, and every row gained a price and spec source.
10. **An intermittent hydration error** traced to Next.js build workers resolving the footer's git hash differently.

## Architecture decisions

- **D1: compute in the browser.** The engine is pure TypeScript, so the UI runs it in `useMemo` (a 72-month forecast takes ~0.03 ms). The REST routes wrap the same functions (`computeFarmReport`, `generateForecast`) and echo the assumptions they used. Result: instant feedback, honest privacy copy, and motion that can follow inputs.
- **One implementation of everything.** Cooling sizing existed three times (one without derating); catalogs existed twice. Now there is one `lib/cooling.ts`, one `lib/catalog.ts` over `data/*.json`, and one revenue formula in `lib/unitEconomics.ts`, shared by the dashboard, the miner comparison and MCP.
- **MCP as a thin layer.** `/api/mcp` is stateless Streamable HTTP (`mcp-handler` 2 + MCP SDK v2, serving the 2026-07-28 protocol and 2025-era clients). Seven read-only tools call the same engine; inputs and outputs are zod schemas; every result echoes its market snapshot; errors are actionable ("Unknown miner id 's21xp'. Did you mean 's21-xp'?"). A test asserts `calculate_farm(Small Farm)` equals the UI engine's output exactly.
- **Design: "Control Room".** Chosen from three mockups: graphite and blueprint-paper themes from one token set, one accent (orange) reserved for live market data, and motion only where it explains cause and effect: a live schematic whose power flow scales with MW, a thermal pin-drop that shows what a site's climate costs, numbers that roll to their new value. Everything respects `prefers-reduced-motion`, and every tab passes axe in both themes.

## Verification

Lint, typecheck, ~650 unit tests (engine, golden fixtures, catalog integrity, API contract, MCP tools and route) and a Playwright matrix (light, dark, reduced motion, mobile, axe) run in CI. The MCP server was exercised with the MCP Inspector against live data.
