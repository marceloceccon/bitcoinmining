# P2 — Data refresh (credibility release, tag v1.1.0)

Branch `revamp/p2-data` (stacked on `revamp/p1-engine`) → `main`. Spec: `tasks/todo.md` §5 P2.

## What changed
- **Miner schema v2** (additive): every row now has `cooling`, `status`, `segment`, `price_basis`, `price_as_of`, `price_source` and `spec_source`. These are validated when present on client-sent miners, and `/api/miners` docs and OpenAPI are updated.
- **`data/miners.json`**: 90 models, with each spec and price re-verified against a source on 2026-10-03.
  - 37 current industrial units: the S21 / S21+ / S21 XP families, the S23 family, M60–M73, A15/A16, and SealMiner A2/A3.
  - 7 home units: Avalon Nano 3/3S, Mini 3, Q; Bitaxe Gamma/GT; NerdQAxe++.
  - 6 announced units, hidden by default: S23 XP Hyd, SealMiner A4, M73S+/M76S+.
  - 40 legacy units, repriced as Luxor index band × TH/s. The anomalous 14–19 J/TH band is not used, and units above 38 J/TH are priced on a low-confidence used tier.
  - Sanity checks: S19j Pro $118, S19 XP $440.
- **Removed**: `ck5` and `ck6` are Goldshell Eaglesong/CKB miners and can't mine Bitcoin. `s21-ultra` and `a1346-pro` aren't real products; their specs duplicated other rows.
- **Renamed or corrected rows** (same ids): for example, `s19-hydro` had the S19 Pro+ Hyd's specs, `m66s` is immersion-cooled, and `a1566` is 3,420 W.
- **Presets reference catalog ids**:
  - Home: 1 × Avalon Q, self-maintained, 5 m cable.
  - Garage: 10 × S21 XP.
  - Small Farm: 100 × S21 XP.
  - Industrial: 500 × S21 XP Hyd.
  - All four are OPEX-profitable at $0.05/kWh at today's market (tested).
- **Gentler first impression**: a fresh visit opens on Small Farm. "Loses money" is now an informative card that shows the break-even power price; red is reserved for real misconfigurations.
- **Freshness**: "Hardware prices as of Oct 2026" appears in the miner list and the footer. The miner list has an Industrial/Home filter, an announced toggle, badges, and links to each price's source.
- **`data/README.md`**: documents the schema, the sources, and the quarterly refresh process.

## Prices to review
- S21 XP is $3,454 and S21 XP Hyd $6,250: in-stock reseller prices. Bitmain's shop is about $17/TH ($4,590 and $8,041).
- S23e Hyd 2U uses Bitmain's $19,030 presale price. Resellers still list about $9.5k from an expired promotion.
- The 13 units above 38 J/TH are tier estimates at low confidence; no live used listings were found.

## Golden fixtures
The fixtures now run the shipping presets, so the inputs changed and there is no like-for-like delta. New baseline at the frozen market (48 months, 10% network growth, sell_opex):

| Preset | CAPEX | Month-1 revenue | Month-1 OPEX |
|---|---|---|---|
| Home | $2,857 | $103 | $76 |
| Garage | $46,203 | $3,096 | $1,874 |
| Small Farm | $435,429 | $30,962 | $17,648 |
| Industrial | $4.04M | $271,206 | $130,499 |

The P1.9 OPEX itemization keeps the pre-P2 Industrial definition (500 × S21 Hyd) as a fixed case.

## Verification
lint, typecheck, 612 unit tests (the data tests run per row), build and 16 e2e: all green.
