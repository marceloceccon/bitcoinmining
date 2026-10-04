# MCP directories

## Official MCP Registry
Published via `mcp-publisher publish` (G3, see `tasks/pr/p5-mcp.md`). Name: `com.bitcoinminingfarmcalculator/mineforge`.

## Listing paragraph (awesome-mcp-servers and similar)
- **[MineForge](https://www.bitcoinminingfarmcalculator.com/mcp)** — Plan Bitcoin mining farms: compare ASICs at your power price, engineer power, transformer and cooling for a site's real climate, itemized CAPEX/OPEX, and forecasts from live network data. Remote, stateless Streamable HTTP, read-only, no API key. `https://www.bitcoinminingfarmcalculator.com/api/mcp`

## PR text
> Adds MineForge, a remote MCP server for planning Bitcoin mining farms (finance / energy). Seven read-only tools (`get_network_stats`, `list_miners`, `get_miner`, `compare_miners`, `calculate_farm`, `forecast_farm`, `size_cooling`); every result echoes the market snapshot and assumptions used. No auth, rate-limited per IP. Open source (MIT): https://github.com/marceloceccon/bitcoinmining

Candidate lists (check each list's category and format rules before opening a PR): punkpeye/awesome-mcp-servers, wong2/awesome-mcp-servers, appcypher/awesome-mcp-servers.
