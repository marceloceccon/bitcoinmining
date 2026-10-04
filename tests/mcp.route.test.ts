import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/mcp/route';

/** Send one JSON-RPC request the way a 2025-era Streamable HTTP client does and parse the SSE reply. */
async function rpc(method: string, params?: unknown) {
  const res = await POST(
    new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
  expect(res.status).toBe(200);
  const text = await res.text();
  const data = text.split('\n').find((l) => l.startsWith('data: '));
  return JSON.parse(data ? data.slice(6) : text);
}

describe('POST /api/mcp (JSON-RPC over Streamable HTTP)', () => {
  it('tools/list advertises the seven read-only tools with schemas', async () => {
    const { result } = await rpc('tools/list');
    const names = result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(['calculate_farm', 'compare_miners', 'forecast_farm', 'get_miner', 'get_network_stats', 'list_miners', 'size_cooling']);
    for (const t of result.tools) {
      expect(t.annotations.readOnlyHint).toBe(true);
      expect(t.inputSchema.type).toBe('object');
      expect(t.outputSchema.type).toBe('object');
    }
  });

  it('tools/call calculate_farm with the Small Farm preset returns structured metrics and assumptions', async () => {
    const { result } = await rpc('tools/call', {
      name: 'calculate_farm',
      arguments: { miners: [{ id: 's21-xp', quantity: 100 }], electricityPriceKwh: 0.05, infrastructure: 'containers' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.metrics.totalCapex).toBeCloseTo(435429, 0);
    expect(result.structuredContent.assumptions.market.isLive).toBe(false); // unit tests run offline
    expect(result.content[0].text).toMatch(/CAPEX \$435,429/);
  });

  it('invalid arguments come back as a tool error, not a crash', async () => {
    const { result, error } = await rpc('tools/call', { name: 'calculate_farm', arguments: { miners: [], electricityPriceKwh: -1 } });
    expect(error ?? result.isError).toBeTruthy();
  });

  it('resources and the planning prompt are listed', async () => {
    const resources = await rpc('resources/list');
    expect(resources.result.resources.map((r: { uri: string }) => r.uri).sort()).toEqual(['mineforge://catalog/miners', 'mineforge://docs/methodology']);
    const prompts = await rpc('prompts/list');
    expect(prompts.result.prompts.map((p: { name: string }) => p.name)).toEqual(['plan_mining_farm']);
  });
});
