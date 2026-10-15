# SEO pass with Claude SEO (audit + code fixes)

Branch `seo/claude-seo-optimizations` → `main`. Spec: `tasks/todo.md` §11.

[Claude SEO](https://claude-seo.md) v2.4.2 (the latest release; it was already installed and `doctor` reports ready) ran a full `/seo audit` against production on 2026-10-15. Six specialist audits ran: technical, content/on-page, schema, performance/images, GEO/agent readiness and SXO. This PR fixes every code-level finding that holds up against the code. Dashboard and off-site items are listed at the end.

## Audit score (before this PR)

| Category | Weight | Score |
|---|---|---|
| Technical SEO | 22% | 74 |
| Content quality | 23% | 60 |
| On-page SEO | 20% | 72 |
| Schema | 10% | 58 |
| Performance (CWV) | 10% | 97 |
| AI search readiness | 10% | 62 |
| Images | 5% | 93 |
| **SEO Health Score** | | **71** |

Lab CWV (Lighthouse 13.5, mobile): LCP 1.7–2.1 s, TBT ≤ 60 ms, CLS ≤ 0.001 on every page. No Google, Matomo or backlink API credentials are configured, so the audit has no field data or link data.

## What changed

**Duplicate host and indexing**
- **The apex is a full duplicate of the site.** Since the move to Cloudflare, `https://bitcoinminingfarmcalculator.com` returns 200 on every page (P7.2 recorded a 308 when Vercel served it). `next.config.js` now has host-matched `redirects()` that send the apex to `www` with a 308 and keep the path and query. There are two rules (`/` and `/:path+`) because OpenNext leaves an empty `:path*` unsubstituted, which sent the apex root to a literal `/:path*` on workerd.
- **Subpages advertised the homepage to social and AI crawlers.** /methodology and /mcp inherited the layout's `og:url`, `og:title`, `og:description` and Twitter tags, and the 404 page inherited the homepage canonical. The new `pageMetadata()` in `lib/site.ts` gives each page its own canonical, OG and Twitter tags. The layout keeps only site-wide metadata.
- **Sitemap `lastmod` was the build time for every URL**, which Google ignores. It now comes from `PAGE_UPDATED` in `lib/site.ts`, which also feeds the TechArticle `dateModified`. For the homepage it's the later of that date and the miner catalog's `lastUpdated`. Dropped `changefreq` and `priority`, which Google ignores.
- **/api-docs** now has a canonical, plus a `<noscript>` H1, an intro and an endpoint list generated from `openapi.json`. Its raw and runtime titles now match.
- **`X-Robots-Tag: noindex`** on `/api/*` and `/openapi.json`. They stay crawlable for agents but stay out of search results. On Cloudflare, static assets are served before the Worker, so `public/_headers` carries the `/openapi.json` rule. Workers doesn't serve `_headers` itself; Vercel serves it as an ordinary static file.
- **Baseline security headers** on every response: `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN` and `nosniff`. There's no CSP yet, because the theme script and analytics are inline; that needs its own PR.

**Content and on-page**
- **The methodology copy contradicted the engine.** It said 10 miners per rack (the engine uses 50), 100 per container (250), "50+ miners" (90), forecasts of 12–60 months (the UI allows up to 72) and "pre-configured rates for 20+ countries" (no such presets exist; there are per-component rates). The OPEX paragraph left out maintenance and labor. `SeoContent.tsx` now renders these figures from `RACK_MINERS_CAPACITY`, `CONTAINER_MINERS_CAPACITY`, `MINERS.length` and `DRY_COOLERS.length`, so the copy can't drift from the code again. The JSON-LD feature list dropped "country-specific".
- **Titles, H1s and descriptions now target the queries.** Previously no H1 contained "calculator", and descriptions ran 184–221 characters.
  - Home: "Bitcoin Mining Farm Calculator — Profitability, CAPEX & ROI" (59 chars), with a 146-character description. The hero H1 keeps its line and adds a "Bitcoin mining farm calculator" eyebrow inside the H1.
  - /methodology: "How the Bitcoin Mining Farm Calculator Works | MineForge". H1: "How the MineForge Bitcoin mining calculator works".
  - /mcp: "Bitcoin Mining MCP Server for AI Agents | MineForge" (it was 71 chars).
  - /api-docs: "Free Bitcoin Mining Calculator API Reference | MineForge".
- **Homepage FAQ.** The homepage had about 130 words of explanation. The FAQ moved there from /methodology and gained three questions: how profitability is calculated, the break-even $/kWh, and payback. Each answer is checked against `lib/bitcoin.ts` and `lib/forecasting.ts`. A single array in `lib/faq.ts` (renamed from `faqJsonLd.ts`) feeds both the visible `<dl>` and the `FAQPage` JSON-LD; the old copies had drifted apart. /methodology links to it.
- **Author:** `authors` and `creator` were the product name. They are now Marcelo Ceccon, linked to GitHub.

**Structured data**
- The site-wide `@graph` now holds `WebSite`, `Organization` (founder, `sameAs` repo), `Person` and `SoftwareApplication`, all linked by `@id`. `SoftwareApplication` gains `author`, `publisher`, `screenshot` and `license`.
- /methodology has a `BreadcrumbList` and a `TechArticle` with `dateModified`. /mcp has a `BreadcrumbList`.

**Performance, images and accessibility**
- **Vercel Analytics 404s on Cloudflare.** `/_vercel/insights/script.js` doesn't exist there, so every page logged a console error, which was the only Best Practices deduction (96). `<Analytics />` now renders only when `process.env.VERCEL` is set.
- The above-the-fold header logo is now `priority` (it was lazy-loaded).
- The manifest had maskable-only icons. It now has `any` and `maskable` entries.
- The mobile results bar's `aria-label="Show full results"` hid the visible figures from its accessible name (WCAG 2.5.3, flagged by Lighthouse). It's replaced by an `sr-only` prefix.
- **Price-source links:** most `price_source` values mix a URL with free text. The old `startsWith("http")` check put the whole string into `href`, which broke 39 of 49 links, and URLs that came after a note were never linked. `MinerSelector` now links the first URL in the field (84 of 90 miners) and shows the rest in the tooltip.

**Agents**
- `llms.txt` lists all 7 REST endpoints (it had 4) and links the FAQ.

## Tests
- `tests/seo.test.ts`: the sitemap URLs and real lastmod, `pageMetadata` canonical/OG, FAQ JSON-LD generated from the visible FAQ, and the /api-docs canonical and endpoint list.
- e2e: a new test checks that every page's canonical and `og:url` are its own, and that the homepage FAQ questions equal the `FAQPage` questions. Two heading assertions follow the new H1s.
- Checked on workerd (`pnpm cf:build` + `wrangler dev`, built from a scratch copy per lessons.md): the apex `/`, `/mcp?x=1` and `/methodology/` all return 308 to www, `/openapi.json` and `/api/*` send noindex, and `/_headers` returns 404.
- Checked by hand against `next start`: the apex `Host` returns 308 to `https://www.…/mcp?x=1`, the `/api/*` and `/openapi.json` noindex headers are set, the JSON-LD parses on every page, and there is one `og:image` per page.

## Golden-fixture deltas
None. No engine code changed.

## Not in this PR (needs the dashboard or off-site work)
- **Cloudflare managed robots.txt.** It disallows GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended, GoogleOther, Baiduspider and PetalBot, and sends `Content-Signal: search=yes,ai-train=no,use=reference` with no `ai-input`. Search and answer bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot, ChatGPT-User) are allowed. This is a policy decision for the owner:
  - Blocking Google-Extended keeps the site out of Gemini grounding.
  - Baiduspider and PetalBot are search engines.
  - Consider adding `ai-input=yes`.
- **Cloudflare cache purge on deploy.** HTML is served with `s-maxage=31536000` and has an offline market snapshot baked in.
- **MCP Registry.** `/.well-known/mcp-registry-auth` returns 404 in production, and the server isn't in the registry. The launch docs say to set `MCP_REGISTRY_AUTH` on Vercel, but production now runs on Cloudflare. Set it as a Cloudflare secret, run `mcp-publisher publish`, then send PRs to the awesome-mcp-servers lists.
- **MCP methodology resource on Cloudflare.** It can't read `ARCHITECTURE.md` from disk (already known, see §10). Embedding it at build time would fix it.
- **SXO (product decisions, not SEO plumbing).** The ranking pages for "bitcoin mining calculator" are single-miner tools with $/kWh as the first input and daily profit and payback as the headline numbers. Options:
  - a $/kWh field in the summary bar
  - payback above the fold
  - a "single miner" preset button
  - a one-line market ticker on phones
- **Authority.** Add GitHub topics, a Show HN and r/BitcoinMining write-up, a YouTube walkthrough, and Bing Webmaster Tools and IndexNow. Add Google Search Console credentials to the next audit for field data.
