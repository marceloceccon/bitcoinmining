# MineForge

**Bitcoin Mining Farm Calculator — Free CAPEX & ROI Tool**

A free, privacy-first Next.js 15 web application for calculating Bitcoin mining profitability, building virtual farms, and forecasting ROI. Includes a free, rate-limited API for developers and AI agents.

## Features

### Core Functionality
- **50+ Real ASIC Miners** — Complete database with hash rates, power consumption, prices, and degradation curves
- **Farm Builder** — Add unlimited miners, configure quantities, real-time calculations
- **Live Metrics Dashboard** — Hash rate, power draw, heat output, electrical requirements
- **Solar Simulation** — 0-100% solar coverage with cost modeling and grid fallback
- **Regional Presets** — Pre-configured electricity prices for US, Brazil, China, EU + custom
- **Advanced Electrical Calculations** — Copper cable sizing, transformer tiers, parasitic loads
- **Cooling Options** — Air cooling vs hydro with dry cooler cost modeling

### Forecasting Engine
- **Multi-Period Forecasts** — 12/24/36/48/72 month projections
- **Stock-to-Flow BTC Price Model** — With pessimistic adjustment slider
- **Network Difficulty Modeling** — Auto-calculates next 4 halvings
- **Three Revenue Modes**: Sell all, Hold all, Sell OPEX only
- **ASIC Degradation** — Annual efficiency loss modeling
- **NPV, IRR, Break-even** — Professional financial metrics

### Free API
All calculations are available as a free, rate-limited REST API:

| Endpoint | Method | Description |
|---|---|---|
| `/api/miners` | GET | List all ASIC miners in the database |
| `/api/dry-coolers` | GET | List all dry cooler models |
| `/api/air-fans` | GET | List all air fan models |
| `/api/calculate` | POST | Calculate farm metrics from a FarmConfig |
| `/api/forecast` | POST | Generate multi-year revenue forecast |
| `/api/network` | GET | Live BTC price, hashrate, difficulty |
| `/api/updates` | GET | Last update timestamps for data |

**Rate limits**: 60 requests/minute per IP for external callers. No limits for same-origin requests from the website.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Charts**: Recharts
- **Maps**: Leaflet + react-leaflet
- **Deployment**: Vercel-ready

## Installation

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
cd mineforge
npm install
npm run dev
# Open http://localhost:3000
```

No external database or environment variables required. All data is embedded in JSON files under `data/`.

## Data Files

Hardware catalogs are stored as JSON in the `data/` directory:

- `data/miners.json` — ASIC miner catalog (50+ models)
- `data/dryCoolers.json` — Dry cooler models (26 models)
- `data/airFans.json` — Industrial air fan models
- `data/updates.json` — Last update timestamps

To update miner prices or add new models, edit the JSON files directly and update the timestamp in `updates.json`.

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Deploy — no environment variables needed

### Other Platforms
Works on any platform supporting Next.js 15: Netlify, Railway, AWS Amplify, Docker.

## Privacy

No accounts. No tracking. No cookies. Your farm configuration lives entirely in your browser.

## License

MIT License

---

**Long Bitcoin, Short the Bankers**
