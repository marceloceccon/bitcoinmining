# P4 — Visual revamp and motion (Control Room)

Branch `revamp/p4-ui` (stacked on P3 → P2 → P1 → P0). Spec: `tasks/todo.md` §5 P4. G1 = **A · Control Room**.

## What changed
- **Design system (P4.1):** a single token set with a light "blueprint paper" theme and a dark graphite theme that follow the system preference, plus a 3-state toggle. Geist and Geist Mono. Orange is reserved for live market data. The glass classes, the blueprint palette and the hardcoded chart hex values are gone.
- **Primitives (P4.2):** Button and Card built with CVA; WAI-ARIA Tabs with `?tab=` deep links; Dialog with a focus trap and a bottom-sheet variant; Tooltip with `aria-describedby` and tap support; a labelled Slider; and `Metric`, which rolls numbers and tints the delta.
- **Layout (P4.3):** market ticker, sticky header, hero (value proposition, live schematic, CTAs), headline figures, workbench tabs with sticky results on desktop and a summary bar that opens a sheet on mobile. About, API, privacy and disclaimer content moved to `/methodology`.
- **Signature 1 (P4.4):** the live farm schematic. Its layout is a pure, tested function. Power flow speed scales with MW, the heat plume scales with heat load and climate, layout changes morph, and large farms are drawn as grouped `×N`.
- **Signature 2 (P4.5):** the location picker has search, an inline SVG pin drop and dark tiles. The Thermal summary rolls in the climate figures, sweeps the derating gauge and shows "+N dry coolers vs default climate".
- **Signature 3 (P4.6):** the Projections hero shows the break-even BTC price against today's price, with margin of safety, payback, IRR and NPV. The cash-flow chart draws only on first view and cross-fades between scenarios. A tornado chart shows the key drivers.
- **Compare miners (P4.7):** daily revenue, cost and profit at your $/kWh, plus break-even $/kWh, $/TH and payback. Sortable and filterable.
- **Persistence and sharing (P4.9):** the farm is saved locally (versioned, rehydrated after mount). "Copy share link" encodes the farm into `?s=`.
- **Advanced settings (P4.10):** sliders for parasitic load, uptime and maintenance.
- **OG image and favicon (P4.11):** the OG image shows the schematic with real numbers. The favicon went from 117 KB to 367 bytes.
- **Performance and accessibility (P4.12):** Recharts is lazy-loaded (first-load JS 339 → 217 kB). axe runs on every tab in light, dark and mobile. Playwright now has light, dark, reduced-motion and mobile projects, and reduced motion is enforced in CSS.

## Golden fixtures
Unchanged: P4 doesn't touch the engine.

## Verification
lint, typecheck, 629 unit tests, build, and 70 e2e checks (4 projects, including axe): all green. Local Lighthouse mobile: 98 / 100 / 96 / 100. The 96 is the local-only Vercel Analytics 404; re-check on the preview.

## Needs you
Review the Vercel preview in both themes and on a phone.
