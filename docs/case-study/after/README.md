# Case study: "After" snapshot

| | |
|---|---|
| Capture date | 2026-10-04 |
| Build | `revamp/p4-ui` (Control Room direction, G1), production build on localhost |
| Browser | Playwright 1.63.0, Chromium rev 1243, headless |

## Screenshots

`capture.mjs` produced them (`node docs/case-study/after/capture.mjs [baseUrl]` against a running build).

- `1440-dark-*`: 1440×900, dark (graphite) theme
- `1440-light-*`: 1440×900, light (blueprint paper) theme
- `390-dark-*`: 390×844 @2x, mobile, dark theme

Each set includes `landing` (viewport only) plus full-page captures of every tab (`build`, `compare-miners`, `energy`, `deploy-and-labor`, `thermal`, `projections`) and `methodology`.

**State.** A fresh visit now opens on the Small Farm preset (100 × Antminer S21 XP), so no template click is needed. The "before" set had to apply a template first. Market data was live at capture time.

## Lighthouse (mobile)

Local Lighthouse 13.5.0, default mobile preset, against the local production build. That's the same tool and settings as the "before" run, but a local server rather than Vercel, so performance figures aren't directly comparable. Re-run on the Vercel preview for the official P4.12 numbers.

| Category | Before (prod, 13068ae) | After (3 runs) |
|---|---|---|
| Performance | 99 | **98** / 98 / 98 |
| Accessibility | 91 | **100** |
| Best Practices | 100 | **96** |
| SEO | 100 | **100** |

Lab metrics (after): FCP 0.9 s, LCP 2.3 s, TBT 20 ms, CLS 0.001. First-load JS on `/` is 217 kB (Recharts loads only with the Projections tab).

- **Best Practices 96:** the only failing audit is `errors-in-console`, from the 404 for `/_vercel/insights/script.js`. Vercel Analytics is only served on Vercel, so this is expected locally and absent on the preview and in production.
- **Accessibility 100:** the before run's unlabeled sliders and low-contrast tab numbers are fixed. Every tab and `/methodology` also pass axe (WCAG 2.1 A/AA, no serious or critical violations) in the light, dark and mobile Playwright projects.

`lighthouse-mobile.json` is the full report from run 2.
