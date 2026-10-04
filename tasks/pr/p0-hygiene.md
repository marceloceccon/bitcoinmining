# P0 — Baseline and hygiene

Branch `revamp/p0-hygiene` → `main`. Spec: `tasks/todo.md` §5 P0.

## What changed
- **pnpm everywhere** (P0.2): removed `package-lock.json`. CI and Docker use pnpm (`packageManager: pnpm@12.5.1`, `pnpm-workspace.yaml` `allowBuilds`). CI gained `pnpm typecheck` and Playwright e2e.
- **Supabase leftovers removed** (P0.3): `supabase/`, `.env.example`, the tracked `.openapi-gen/manifest.json` (now ignored), and the stale copy.
- **Copy matches code** (P0.4, D1/D3): "No tracking" → "Anonymous page analytics only". "Runs entirely in your browser" → "Calculations run on this site's own API; your configuration is never stored". README now says pnpm and Node 22, has the real miner count, and drops the regional-presets claim. The open-source paragraph links GitHub. Dead code is gone: `showMetrics`, `bg.jpg/webp`, `--primary-glow`, `.glass-card-hover`. Removed the hidden 2×2 px hero screenshot (cloaking risk). JSON-LD logo now points at an existing icon.
- **Golden fixtures** (P0.5): `tests/golden/` runs the 4 presets through `calculateFarmMetrics` + `generateForecast` (frozen clock 2026-10-03, BTC $84,700) and diffs every number. Re-capture with `pnpm test:golden:update`.
- **Playwright smoke e2e** (P0.6): load with no console errors, every preset, every tab, map modal + Esc, at 1440 px and 390 px.
- **Placeholder illustrations removed** (P0.7), including the previously uncommitted `TemperatureControl.tsx` diff.
- **Rate limiter** (P0.8): every `/api/*` request is now limited per IP. First-party UI (`Sec-Fetch-Site: same-origin` or a matching `Origin`) gets 600/min; everything else (curl, agents, other sites) gets 60/min. Before this, requests without an `Origin` header were unlimited. Docs (middleware, README, OpenAPI) now say the limiter is best-effort and per instance.
- **UI fix found while writing e2e**: non-2xx API responses (for example a 429 `{error}`) were stored as data and could crash components. They are now treated as errors (`fetchJson`).
- **Canonical host = www** (P0.9, D4): one `SITE_URL` (`lib/site.ts`) feeds `metadataBase`, sitemap, robots, JSON-LD and the OpenAPI servers.
- **OG image copy** (P0.10): dropped the "Farm Visualizer" pill and the duplicated subtitle.
- **Before material** (P0.1): `docs/case-study/before/` (14 screenshots, Lighthouse 99/91/100/100).

## Golden-fixture deltas
None. The fixtures are introduced here and capture the engine as it is.

## Verification
`pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`: all green (363 unit tests, 14 e2e).

## Needs you
1. **Vercel → Domains:** change the apex → www redirect from 307 to **308 (permanent)**. Check with `curl -sI https://bitcoinminingfarmcalculator.com`.
2. If the Vercel preview install step fails on pnpm, set `ENABLE_EXPERIMENTAL_COREPACK=1` in the project's environment variables (Vercel then honours `packageManager`).
