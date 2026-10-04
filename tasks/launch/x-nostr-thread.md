1/ Most mining calculators answer "what does one ASIC earn today?" I wanted "what does this farm cost to build here, and when does it pay back?" So I rebuilt MineForge. 🧵 https://www.bitcoinminingfarmcalculator.com

2/ Pick a preset and the live farm schematic redraws: grid → transformer (kVA) → PDUs → containers filled by miner count → fans or dry coolers → heat plume. Power flow speeds up with MW. [clip: preset morph]

3/ Drop a pin. It pulls a year of ERA5 climate for that spot, derates dry coolers and re-sizes cooling. West Texas vs northern Norway, same 500 hydro miners: 87% vs 114% of rated capacity, ~$48k of cooling CAPEX apart. [clip: pin-drop]

4/ Projections lead with one number: the break-even BTC price over the horizon, against today's price, with the margin of safety. Price paths are scenarios you choose (flat, ±30%/yr, target) — not predictions. No Stock-to-Flow. [screenshot]

5/ Inputs are live: hashrate, block height, fees per block (mempool.space). Halvings come from block height. 90 miners with dated, sourced prices (Oct 2026).

6/ And your AI agent can use it: MCP server at /api/mcp, seven read-only tools, every answer shows its assumptions.
claude mcp add --transport http mineforge https://www.bitcoinminingfarmcalculator.com/api/mcp

7/ Free, no account, open source. Formulas documented. Tell me what's wrong with my cooling assumptions. github.com/marceloceccon/bitcoinmining
