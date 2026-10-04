# Case study: "Before" snapshot

| | |
|---|---|
| Capture date | 2026-10-03 |
| URL | https://www.bitcoinminingfarmcalculator.com |
| Production commit | `13068ae` (refactor: remove Supabase, add backend API, migrate to pnpm) |
| Browser | Playwright 1.63.0, Chromium 153 (rev 1243), headless, linux arm64 |

## Screenshots

Two viewport sets:

- **1440**: 1440x900 viewport, deviceScaleFactor 1 (desktop)
- **390**: 390x844 viewport, deviceScaleFactor 2, `isMobile` + `hasTouch` (images are 780px wide)

**State.** The `*-landing.png` files are viewport-only captures of the page as a first-time visitor sees it, with no farm configured (the metrics panel reads "No Metrics Yet"). Before the tab captures, the **"Small Farm" Quick Start template** was applied (100 air-cooled units in containers, 23.40 PH/s, 351 kW, $549,900 hardware). Each tab was then clicked, followed by a wait for network idle plus 2 s so the charts could render, and a full-page screenshot was taken. All inputs keep their defaults: 48-month forecast, Sell OPEX, Fixed BTC price, and live BTC price $84,760 at capture time. The "after" capture must apply the same template to give a fair comparison.

Tab labels in the DOM: `01 Miners`, `02 Energy`, `03 Deploy & Labor`, `04 Thermal`, `05 Projections`, `06 About`.

| Tab | Desktop (1440) | Mobile (390@2x) |
|---|---|---|
| Landing (viewport only, empty state) | `1440-landing.png` | `390-landing.png` |
| Miners | `1440-miners.png` | `390-miners.png` |
| Energy | `1440-energy.png` | `390-energy.png` |
| Deploy & Labor | `1440-deploy-and-labor.png` | `390-deploy-and-labor.png` |
| Thermal | `1440-thermal.png` | `390-thermal.png` |
| Projections | `1440-projections.png` | `390-projections.png` |
| About | `1440-about.png` | `390-about.png` |

The PNGs were re-encoded with sharp (`palette: true, compressionLevel: 9, quality: 90`). The largest file is about 1.5 MB.
`capture.mjs` is the script that produced them. Run it from a scratch dir that has `playwright@1.63.0` installed.

## Lighthouse (mobile)

**How obtained.** The PageSpeed Insights API returned HTTP 429 three times (the daily quota for the shared key was exceeded). The scores below therefore come from a **local Lighthouse 13.5.0 run**: the default mobile preset (simulated throttling, mobile form factor), Playwright's Chromium 153 binary as `CHROME_PATH`, and the flags `--headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu`. Lighthouse ran 3 times. The table shows the median, and the full report of run 1 (a median run, Performance 99) is in `lighthouse-mobile.json`.

Lighthouse audits only the initial page state: the Miners tab with no template applied. Controls on the other tabs (Energy, Projections and so on) are not mounted until their tab is clicked, so they were **not** audited. The accessibility score therefore understates issues such as unlabeled sliders on those tabs.

> Local performance scores are **not directly comparable** to PSI field/lab scores (different hardware and network). For the after comparison, re-run with the same local setup.

| Category | Score (run 1 / 2 / 3) | Reported |
|---|---|---|
| Performance | 99 / 100 / 99 | **99** |
| Accessibility | 91 / 91 / 91 | **91** |
| Best Practices | 100 / 100 / 100 | **100** |
| SEO | 100 / 100 / 100 | **100** |

Lab metrics (run 1): FCP 1.0 s, LCP 2.0 s, TBT 90 ms, CLS 0.025, Speed Index 1.0 s, TTI 3.0 s. Run 2, which scored 100, had LCP 1.6 s and TBT 40 ms.

### Notable failing audits

**Accessibility (91)**
- *Form elements do not have associated labels* (`label`): 6 `<input type="range">` sliders have no `<label>` or `aria-label`. On the default (Miners) tab these are the per-category import-tax sliders (Miners, Racks, Containers, Fans, Dry Coolers) and the Pool Fee slider. The visible text next to each slider is not programmatically associated with it.
- *Background and foreground colors do not have a sufficient contrast ratio* (`color-contrast`): the `01`..`06` number prefix on the active tab button (`#a5b3df` on `#1e40af`, 4.2:1 at 12px; needs 4.5:1).

**SEO (100)**: no failing audits.

**Best Practices (100)**: no failing audits.

**Performance (non-perfect audits, for reference)**: Reduce unused JavaScript (about 111 KiB), Legacy JavaScript (about 11 KiB), Render-blocking requests (about 90 ms), Network dependency tree.

## Console and runtime health (1440 run)

The run listened for `console` errors/warnings, `pageerror`, `requestfailed` and HTTP responses with status >= 400. It covered the initial load, the template click and all six tab switches, and it was done twice. **Nothing was observed** in either run: no console errors or warnings, no uncaught page errors, no failed requests and no 4xx/5xx responses.

## Observations for the revamp

- On first load, every tab other than Miners shows an empty "No Metrics Yet" or "No Farm Configured" state until the user adds a miner or picks a template.
- On mobile (390), the tab bar wraps to 3 rows of 2 buttons.
- The long SEO content block below the workbench repeats on every tab, which makes every full-page capture very tall (about 13 to 17k px on mobile).
- With the Small Farm template, the Projections metrics show **IRR -99.0%** next to a positive Net Profit ($71,592) and ROI 10.8%. This looks like an IRR calculation or display bug worth checking.
