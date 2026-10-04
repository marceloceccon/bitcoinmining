# P6 — Launch and portfolio packaging

Branch `revamp/p6-launch` (stacked on P5). Spec: `tasks/todo.md` §5 P6.

- **README (P6.1):** leads with the engine (site-specific thermal sizing, electrical sizing, itemized economics, live-network forecasts, one tested engine for the UI, REST and MCP). Includes the demo GIF, an MCP quick start and the API table; the tech stack moved to the bottom.
- **Demo assets (P6.2):**
  - `docs/media/demo.{mp4,webm,gif}` (31 s): presets morph the schematic; a pin in West Texas vs northern Norway changes dry-cooler derating and cost; Projections shows break-even vs the live price.
  - `docs/media/record-demo.mjs` re-records the demo.
  - `public/screenshot.png` and `docs/screenshot.png` are regenerated.
- **Case study (P6.3):** `docs/case-study.md` covers before/after, the credibility bugs found and fixed, and the architecture decisions.
- **SEO (P6.4):**
  - FAQPage JSON-LD now appears only on `/methodology`, where the FAQ is visible.
  - JSON-LD names MineForge and has a refreshed feature list.
  - Per-page metadata and canonicals for `/`, `/methodology` and `/mcp`.
  - The sitemap lists `/`, `/methodology`, `/mcp` and `/api-docs`.
- **Launch drafts (P6.5):** `tasks/launch/` has drafts for Reddit, Show HN, an X/Nostr thread, MCP directories and LinkedIn. You post these.
- **Fix:** location search no longer re-runs for the result you just picked.
- **P7.3 cross-check:** 1 × S21 XP day-1 revenue is within −1.1% of Hashrate Index (todo §9).

## Needs you
- Run the Google Rich Results test on the preview (`/` and `/methodology`) and submit the sitemap in Search Console.
- Post the launch drafts after the merges, the preview review and G3.
