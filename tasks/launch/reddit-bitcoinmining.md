**Title:** I built a free farm planner that sizes cooling for your actual site's climate (pin a location → dry coolers/fans, derating, CAPEX)

Most calculators stop at TH/s × $/kWh. I wanted one that plans the farm: miner count → power → transformer kVA → cooling for the site's climate → itemized CAPEX/OPEX → monthly cash flow and break-even BTC price.

What it does:
- **Thermal sizing for a real site.** Drop a pin; it pulls a year of ERA5 reanalysis for that point, derates dry coolers above the 35 °C rating (−3 %/°C) and sizes fans or dry coolers. Example: 500 × S21 XP Hyd in Midland, TX (39 °C design max) vs Tromsø (28 °C): dry coolers derate to 87% vs 114% and cooling CAPEX goes from ~$189k to ~$237k.
- **Live network inputs.** Hashrate, tip height and the average fees of the last 144 blocks from mempool.space; halvings by block height; network growth defaults to the trailing 12-month trend.
- **Hardware list with sources.** 90 models, current-gen through legacy, home units included. **Prices are as of Oct 2026** — each row says whether it's a shop/reseller price, a used price or a Luxor-index estimate, with the source. Legacy units are priced from the index, not MSRP.
- **Miner comparison at your $/kWh:** profit/day, break-even $/kWh, $/TH, payback.
- **BTC price as a scenario you pick** (flat, ±30%/yr, or a target). No Stock-to-Flow.

Free, no account, open source (MIT), and the math is documented formula by formula. Feedback from people running real sites very welcome — especially on cooling assumptions and OPEX.

https://www.bitcoinminingfarmcalculator.com
