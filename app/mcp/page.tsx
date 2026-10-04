import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CopyButton from "@/components/CopyButton";
import { TOOLS } from "@/lib/mcp/tools";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Use MineForge from your AI agent (MCP)",
  description:
    "Connect Claude, Cursor or VS Code to the MineForge MCP server and let your agent compare ASICs, engineer a farm, size cooling for a site and forecast it from live Bitcoin network data.",
  alternates: { canonical: "/mcp" },
};

const ENDPOINT = `${SITE_URL}/api/mcp`;

const CLIENTS: { name: string; where: string; code: string }[] = [
  { name: "Claude Code", where: "Terminal", code: `claude mcp add --transport http mineforge ${ENDPOINT}` },
  { name: "claude.ai and Claude Desktop", where: "Settings → Connectors → Add custom connector, then paste the URL", code: ENDPOINT },
  {
    name: "Cursor",
    where: ".cursor/mcp.json",
    code: JSON.stringify({ mcpServers: { mineforge: { url: ENDPOINT } } }, null, 2),
  },
  {
    name: "VS Code",
    where: ".vscode/mcp.json",
    code: JSON.stringify({ servers: { mineforge: { type: "http", url: ENDPOINT } } }, null, 2),
  },
];

/** Input field names straight from each tool's zod schema, so this page can't drift from the server. */
function inputFields(schema: unknown): string[] {
  const shape = (schema as { shape?: Record<string, { isOptional?: () => boolean }> }).shape ?? {};
  return Object.entries(shape).map(([k, v]) => (v.isOptional?.() ? `${k}?` : k));
}

const EXAMPLE = [
  ["You", "Plan a 1 MW air-cooled farm in Asunción, Paraguay at $0.04/kWh."],
  ["Agent → compare_miners", "{ electricityPriceKwh: 0.04, cooling: 'air', status: ['current'] }"],
  ["Agent → calculate_farm", "{ miners: [{ id: 's21-xp', quantity: 261 }], electricityPriceKwh: 0.04, location: { lat: -25.28, lon: -57.63 } }"],
  ["MineForge", "70.47 PH/s · 999 kW · transformer 1,199 kVA · CAPEX $1,136,712 · OPEX $37,012/month · 6 × 56″ fans (ERA5: design max 40.5 °C, 71% humidity)"],
  ["Agent → forecast_farm", "{ …same farm, months: 48, priceScenario: { type: 'flat' } }"],
  ["Agent", "At today's price the farm clears OPEX with a break-even BTC price of about $62k, but it doesn't repay its CAPEX within 4 years on a flat price (needs ~$100k average BTC). Want me to try the bull scenario or a cheaper air-cooled model?"],
];

export default function McpPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-10 px-4 py-10">
        <header className="space-y-3">
          <p className="label">Model Context Protocol</p>
          <h1 className="text-3xl font-semibold tracking-tight text-fg">Use MineForge from your AI agent</h1>
          <p className="max-w-2xl text-fg-2">
            Point any MCP client at one URL and your agent can compare ASICs at your power price, engineer a farm, size
            its cooling for a real site and forecast it from live Bitcoin network data. It runs the same tested engine
            as this site. Free, read-only, no account or API key.
          </p>
          <div className="inset flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <code id="endpoint" className="break-all font-mono text-sm text-fg">{ENDPOINT}</code>
            <CopyButton text={ENDPOINT} targetId="endpoint" />
          </div>
        </header>

        <section aria-labelledby="connect" className="space-y-4">
          <h2 id="connect" className="text-xl font-semibold text-fg">Connect a client</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {CLIENTS.map((c, i) => (
              <div key={c.name} className="panel min-w-0 p-4">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-fg">{c.name}</h3>
                  <CopyButton text={c.code} targetId={`snippet-${i}`} />
                </div>
                <p className="mb-2 text-xs text-muted">{c.where}</p>
                <pre id={`snippet-${i}`} tabIndex={0} aria-label={`${c.name} configuration`} className="inset overflow-x-auto p-3 font-mono text-xs text-fg">{c.code}</pre>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted">
            Streamable HTTP, stateless. Rate-limited to 60 requests per minute per IP. Every result echoes the market
            snapshot and assumptions it used.
          </p>
        </section>

        <section aria-labelledby="tools" className="space-y-4">
          <h2 id="tools" className="text-xl font-semibold text-fg">Tools</h2>
          <dl className="divide-y divide-line rounded border border-line">
            {Object.entries(TOOLS).map(([name, t]) => (
              <div key={name} className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr]">
                <dt className="font-mono text-sm font-semibold text-fg">{name}</dt>
                <dd className="space-y-1 text-sm text-fg-2">
                  <p>{t.description}</p>
                  {inputFields(t.inputSchema).length > 0 && (
                    <p className="font-mono text-xs text-muted">({inputFields(t.inputSchema).join(", ")})</p>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted">
            Resources: <code className="font-mono">mineforge://catalog/miners</code>,{" "}
            <code className="font-mono">mineforge://docs/methodology</code>. Prompt:{" "}
            <code className="font-mono">plan_mining_farm(budgetUsd, electricityPriceKwh, location)</code>.
          </p>
        </section>

        <section aria-labelledby="example" className="space-y-4">
          <h2 id="example" className="text-xl font-semibold text-fg">Example conversation</h2>
          <ol className="space-y-2">
            {EXAMPLE.map(([who, text], i) => (
              <li key={i} className={`rounded border border-line p-3 text-sm ${who.startsWith("Agent →") ? "bg-surface-2 font-mono text-xs" : "bg-surface"}`}>
                <span className="label mr-2">{who}</span>
                <span className="text-fg-2">{text}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted">Figures from a real run on 2026-10-04 with live market data; yours will differ.</p>
        </section>

        <p className="text-sm text-muted">
          Prefer plain HTTP? The same engine is a <Link href="/api-docs" className="text-fg underline underline-offset-2">REST API</Link>.
          Methodology: <Link href="/methodology" className="text-fg underline underline-offset-2">how the numbers are made</Link>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
