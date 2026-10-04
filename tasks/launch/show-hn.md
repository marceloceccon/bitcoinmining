**Title:** Show HN: MineForge – a Bitcoin mining farm planner your AI agent can call via MCP

**URL:** https://www.bitcoinminingfarmcalculator.com/mcp

**Text:**
MineForge plans a mining farm end to end: miner count → power and transformer kVA → cooling sized for the site's climate (ERA5 data for the pin you drop) → itemized CAPEX/OPEX → a multi-year forecast from live network data (hashrate, block height, fees; halvings by height; the BTC price is a scenario you choose).

The engine is pure TypeScript, so the same code runs in three places: in the browser (no calculation requests at all), behind a REST API, and as an MCP server at /api/mcp. The MCP side is stateless Streamable HTTP with seven read-only tools (compare_miners, calculate_farm, forecast_farm, size_cooling, …). Every result echoes the market snapshot and assumptions it used, so an agent can show its work.

    claude mcp add --transport http mineforge https://www.bitcoinminingfarmcalculator.com/api/mcp

Then ask "plan a 1 MW air-cooled farm in Paraguay at $0.04/kWh".

Some things I'm happy with: golden fixtures pin every engine number, so each change that moves one has to be explained (switching from a hardcoded 750 EH/s to the live ~964 moved month-1 revenue −22%); a test asserts the MCP tool and the UI produce identical output; and the formulas are documented in ARCHITECTURE.md.

Source (MIT): https://github.com/marceloceccon/bitcoinmining
