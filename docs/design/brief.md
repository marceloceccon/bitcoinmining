# Design brief — MineForge · Bitcoin Mining Farm Calculator

**What it is.** A planning tool that turns a site, a power price and a set of ASICs into an engineered farm: miner count → MW → transformer kVA → cooling units at the site's climate → CAPEX → monthly cash flow → break-even BTC price. The same tested engine runs in the browser, behind a public REST API and (soon) as an MCP server for AI agents.

**Audiences.**
1. *Hiring managers and clients* (portfolio): they skim for 10 seconds. They should see a precise, data-alive product and a thing no competitor has (the live farm schematic and the thermal pin-drop) in one or two interactions.
2. *Miners* (users): they want numbers they trust. Current hardware, live hashrate and fees, visible data freshness, and a break-even they can act on.

**Personality.** Precise, engineering-grade, trustworthy, alive with real data. It should feel like instrumentation for a real facility (SCADA, a power-plant control room, a datasheet), not a crypto dashboard.

**Principles.**
- Numbers are the hero: tabular figures, real units (TH/s, kW, kVA, m³/h, $/kWh, J/TH), and visible provenance (live / offline estimate, "prices as of").
- One accent. Bitcoin orange is reserved for live market data. Everything else gets semantic hues: heat amber→red, cooling blue, money green/red.
- Motion explains cause and effect. An input changes, the affected outputs roll to their new value with a short delta tint. The schematic's power flow and heat plume scale with MW and climate. Nothing moves without a state change behind it, except one subtle "live" pulse on the market ticker. `prefers-reduced-motion` means no movement.
- Mobile works: results collapse into a sticky summary bar (hashrate · MW · CAPEX · monthly profit).

**Non-goals.** Crypto-casino glow, neon gradients, ambient looping decoration, motion that explains nothing, glassmorphism. Don't repeat the "cyberpunk glassmorphism" phase or the light "blueprint glass" phase from the project's history.

**Directions to explore (G1).**
- **A. Control Room** (recommended): dark graphite by default with a light "blueprint paper" mode, a faint engineering grid, 1 px hairline rules, a mono face for figures. Reads as SCADA for a real facility.
- **B. Engineering Datasheet**: light and Swiss, print-like spec-sheet typography, dense tables, restrained motion. The most B2B-credible and the least showy.
- **C. Thermal**: dark, with thermal-camera gradients as the visual language, tying everything to the cooling showcase. The most striking, with the highest risk of looking like a theme.

Each mockup shows the hero, a metric row, one chart, the farm schematic and the mobile layout, with real numbers from the engine (Small Farm preset at the 2026-10-03 market).
