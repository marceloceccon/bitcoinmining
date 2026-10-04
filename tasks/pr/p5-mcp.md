# P5 — MCP server

Branch `revamp/p5-mcp` (stacked on P4). Spec: `tasks/todo.md` §5 P5.

## What changed
- **`/api/mcp`:** a public, read-only, stateless Streamable HTTP server built on `mcp-handler` 2.2, `@modelcontextprotocol/server` 2.3 and `zod` 4.6. It serves 2026-07-28 clients natively and 2025-era clients through the stateless fallback.
- **Tools** (7): `get_network_stats`, `list_miners`, `get_miner`, `compare_miners`, `calculate_farm`, `forecast_farm`, `size_cooling`.
  - Each has zod input and output schemas, `readOnlyHint`, `structuredContent` and a ≤5-line text summary.
  - Each echoes the assumptions and market snapshot it used.
  - Errors are actionable (unknown ids get "Did you mean …?") and are returned as `isError` results rather than thrown.
  - The math is shared with the UI and REST: `computeFarmReport`, `generateForecast`, `minerEconomics` and `lib/cooling`.
- **Resources and prompt:** two resources (`mineforge://catalog/miners`, `mineforge://docs/methodology`) and the `plan_mining_farm` prompt.
- **Shared code:**
  - `lib/farmSpec.ts`: turns the agent-facing FarmSpec into a FarmConfig using the same defaults and cooling sizing as the UI.
  - `lib/defaults.ts` and `lib/climate.ts`.
  - Climate lookups are cached per 0.1° for 30 days and send an identifying User-Agent.
- **Rate limiting:** the middleware limits `/api/mcp` to 60 requests/min per IP and returns a JSON-RPC-shaped 429.
- **`/mcp` page:** copy-paste setup for Claude Code, claude.ai/Desktop, Cursor and VS Code; the tool list is generated from the tool definitions; plus an example conversation. Linked from the header, footer, sitemap and API docs.
- **Other files:** `public/llms.txt`, `server.json`, and a `/.well-known/mcp-registry-auth` route that serves the public key from an env var.

## Verification
- Unit tests: every tool as a plain function. `calculate_farm(Small Farm)` matches the UI engine exactly, and JSON-RPC `tools/list` and `tools/call` work through the route. 646 unit tests in total.
- e2e and axe now cover `/mcp`: 77 checks passing.
- MCP Inspector CLI against a production build: `tools/list` returned all 7 tools, and `tools/call` worked with live data (1 MW in Paraguay at $0.04/kWh; summary in todo §9).

## G3: publish to the MCP Registry (you run these; the private key never leaves your machine)
1. **Pick the auth method.** The namespace `com.bitcoinminingfarmcalculator/*` needs proof of control of `bitcoinminingfarmcalculator.com`.
   - **DNS (recommended):** the apex redirects to www, so a TXT record avoids depending on HTTP redirects.
     ```bash
     openssl genpkey -algorithm Ed25519 -out key.pem      # keep key.pem out of the repo
     PUBLIC_KEY="$(openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64)"
     echo "bitcoinminingfarmcalculator.com. IN TXT \"v=MCPv1; k=ed25519; p=${PUBLIC_KEY}\""   # add this TXT record
     PRIVATE_KEY="$(openssl pkey -in key.pem -noout -text | grep -A3 "priv:" | tail -n +2 | tr -d ' :\n')"
     mcp-publisher login dns --domain bitcoinminingfarmcalculator.com --private-key "${PRIVATE_KEY}"
     ```
   - **HTTP:** set the Vercel env var `MCP_REGISTRY_AUTH` to `v=MCPv1; k=ed25519; p=${PUBLIC_KEY}` and redeploy. Check that `https://bitcoinminingfarmcalculator.com/.well-known/mcp-registry-auth` returns it (it follows the apex → www redirect). Then run `mcp-publisher login http --domain bitcoinminingfarmcalculator.com --private-key "${PRIVATE_KEY}"`.
   - **Fallback:** `mcp-publisher login github`. This gives the `io.github.marceloceccon/*` namespace, so change `name` in `server.json` to `io.github.marceloceccon/mineforge`.
2. From the repo root, after production serves `/api/mcp`, run `mcp-publisher publish`.
3. Check that the server is listed at `https://registry.modelcontextprotocol.io/v0/servers?search=mineforge`.

## Also needs you
- **Real-client check:** run `claude mcp add --transport http mineforge <preview-url>/api/mcp`, ask "plan a 1 MW air-cooled farm in Paraguay at $0.04/kWh", and paste the summary into todo §9 (P5.8).
