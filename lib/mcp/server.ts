/**
 * Registers the MineForge tools, resources and prompt on an MCP server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { MINERS } from '@/lib/catalog';
import { TOOLS, runTool, type McpDeps, type ToolName } from './tools';

export const MCP_SERVER_INFO = { name: 'mineforge', version: '1.0.0' };

export const MCP_INSTRUCTIONS =
  'MineForge plans Bitcoin mining farms with a tested engine: power and transformer sizing, cooling at the site climate, itemized CAPEX/OPEX, and forecasts from live network data. ' +
  'Typical flow: compare_miners at the user’s power price → calculate_farm with a FarmSpec → size_cooling for the site → forecast_farm with a price scenario. ' +
  'Every result echoes the market snapshot and assumptions it used; BTC price scenarios are choices, not predictions.';

function readMethodology(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'ARCHITECTURE.md'), 'utf8');
  } catch {
    return 'Methodology: https://github.com/marceloceccon/bitcoinmining/blob/main/ARCHITECTURE.md';
  }
}

export function registerMineForge(server: McpServer, deps: McpDeps): void {
  for (const name of Object.keys(TOOLS) as ToolName[]) {
    const t = TOOLS[name];
    server.registerTool(
      name,
      { title: t.title, description: t.description, inputSchema: t.inputSchema, outputSchema: t.outputSchema, annotations: t.annotations },
      (async (input: unknown) => runTool(name, input, deps)) as any,
    );
  }

  server.registerResource(
    'miner-catalog',
    'mineforge://catalog/miners',
    { title: 'MineForge miner catalog', description: 'Every SHA-256 ASIC in the catalog with specs, prices and their sources (JSON).', mimeType: 'application/json' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(MINERS) }] }),
  );

  server.registerResource(
    'methodology',
    'mineforge://docs/methodology',
    { title: 'MineForge methodology', description: 'Every formula the engine uses and its accuracy (ARCHITECTURE.md).', mimeType: 'text/markdown' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: readMethodology() }] }),
  );

  server.registerPrompt(
    'plan_mining_farm',
    {
      title: 'Plan a mining farm',
      description: 'Walk through choosing miners, engineering the farm, sizing cooling for the site and forecasting it.',
      argsSchema: z.object({
        budgetUsd: z.string().describe('Hardware + build-out budget in USD'),
        electricityPriceKwh: z.string().describe('Power price in USD/kWh'),
        location: z.string().describe('Site, e.g. "Asunción, Paraguay" or "31.9,-102.1"'),
      }),
    },
    ({ budgetUsd, electricityPriceKwh, location }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text:
              `Plan a Bitcoin mining farm with a budget of about $${budgetUsd}, power at $${electricityPriceKwh}/kWh, sited at ${location}.\n` +
              '1. get_network_stats for today’s market.\n' +
              `2. compare_miners at $${electricityPriceKwh}/kWh; shortlist 2–3 current models with the best payback.\n` +
              '3. calculate_farm for the best fit within the budget (location as lat/lon if you can resolve it).\n' +
              '4. size_cooling for the site to check the climate effect.\n' +
              '5. forecast_farm with flat, bear (growth −30) and bull (growth +30) scenarios; report break-even BTC price, payback, IRR and NPV.\n' +
              'State the assumptions each result echoes, and say that price scenarios are not predictions.',
          },
        },
      ],
    }),
  );
}
