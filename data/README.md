# Hardware catalogs

`data/*.json` is the **single source** for the engine, the REST API, MCP and the UI (loaded through `lib/catalog.ts`). Edit the JSON here, never a copy.

| File | Contents |
|---|---|
| `miners.json` | SHA-256 ASIC miners (schema v2, below) |
| `dryCoolers.json` | Dry coolers for hydro/immersion loops (kW at 35 °C, cost, deploy hours) |
| `airFans.json` | Exhaust fans for air-cooled farms (airflow, power, cost) |
| `updates.json` | When each catalog was last refreshed, plus a one-line note |

## Miner fields (schema v2)

Every row carries the original fields (`id`, `name`, `manufacturer`, `algorithm`, `hash_rate_ths`, `power_watts`, `price_usd`, `efficiency_jth`, `release_year`, `watercooled`, `degradation_*`) plus:

| Field | Values | Meaning |
|---|---|---|
| `cooling` | `air` · `hydro` · `immersion` | `watercooled` must equal `cooling !== "air"` |
| `status` | `current` · `legacy` · `announced` | `announced` = not yet shipping: hidden in the UI by default, never used by presets |
| `segment` | `industrial` · `home` | Home units: Bitaxe, NerdQAxe, Avalon Nano/Mini/Q … |
| `price_basis` | `new` · `used` · `index` | How `price_usd` was obtained |
| `price_as_of` | ISO date | When the price was observed |
| `price_source` | URL or index band | Where the price came from |
| `spec_source` | URL | Manufacturer/spec page for the TH/s and W figures |

`tests/data.miners.test.ts` enforces all fields, `|W ÷ TH/s − J/TH| ÷ J/TH < 3 %`, unique URL-safe ids, and that presets never use `announced` units. Prices older than 120 days only print a warning, so the data ages visibly without breaking CI.

## How to refresh prices (quarterly)

1. **Current units** — take the manufacturer shop price (shop.bitmain.com, shop.whatsminer.com, shop.canaan.io, bitdeer.com) or a reputable reseller's new price → `price_basis: "new"`. Price the hash-rate bin you can actually buy; note futures/batch terms in `notes`.
2. **Legacy units** — use the Luxor ASIC price index (via theblock.co or hashrateindex.com): the $/TH of the unit's efficiency band × TH/s → `price_basis: "index"`, and write the band and date in `price_source`. If a band looks anomalous (e.g. cheaper than a less efficient band), don't use it: interpolate or use reseller quotes, and say so in `price_source`. Units outside the index bands → used-market listings, `price_basis: "used"`.
3. **Don't** scrape asicminervalue.com (its terms forbid scraping and business use). The Hashrate Index API needs a paid plan.
4. Re-verify specs against `spec_source`; keep existing ids (external API consumers may use any of them). Only remove a row when it's wrong (e.g. not a SHA-256 miner).
5. Set every touched row's `price_as_of`, update `updates.json` (`lastUpdated` + a note), and run `pnpm test` — including `tests/presets.test.ts`, which checks that every preset is still profitable at $0.05/kWh at the snapshot market. Re-capture golden fixtures (`pnpm test:golden:update`) and explain the deltas in the PR.
