import { describe, it, expect, afterEach } from 'vitest';
import { GET } from '@/app/.well-known/mcp-registry-auth/route';

afterEach(() => {
  delete process.env.MCP_REGISTRY_AUTH;
});

describe('/.well-known/mcp-registry-auth', () => {
  it('is 404 until the public key line is configured', async () => {
    expect(GET().status).toBe(404);
  });

  it('serves only a well-formed public key proof', async () => {
    process.env.MCP_REGISTRY_AUTH = 'v=MCPv1; k=ed25519; p=MCowBQYDK2VwAyEAabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(`${process.env.MCP_REGISTRY_AUTH}\n`);
    process.env.MCP_REGISTRY_AUTH = '-----BEGIN PRIVATE KEY-----';
    expect(GET().status).toBe(404);
  });
});
