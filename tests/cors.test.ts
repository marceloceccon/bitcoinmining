import { describe, it, expect } from 'vitest';
import { corsHeaders, handleOptions } from '@/lib/cors';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://api.example.com/api/calculate', { headers });
}

describe('corsHeaders', () => {
  it('echoes the request Origin when present', () => {
    const headers = corsHeaders(
      makeRequest({ origin: 'https://client.example' }),
    ) as Record<string, string>;
    expect(headers['Access-Control-Allow-Origin']).toBe('https://client.example');
  });

  it('falls back to wildcard when Origin header is absent', () => {
    const headers = corsHeaders(makeRequest()) as Record<string, string>;
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('includes Vary: Origin so caches do not leak across origins', () => {
    const headers = corsHeaders(makeRequest({ origin: 'https://a.example' })) as Record<string, string>;
    expect(headers['Vary']).toBe('Origin');
  });

  it('exposes only the public verbs', () => {
    const headers = corsHeaders(makeRequest()) as Record<string, string>;
    expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
  });

  it('does NOT include Access-Control-Allow-Credentials (CSRF safety)', () => {
    const headers = corsHeaders(makeRequest({ origin: 'https://attacker.com' })) as Record<string, string>;
    // Credentials must not be allowed when we reflect the Origin header,
    // otherwise an attacker site could mount authenticated cross-origin requests.
    expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('caches preflight for 24 hours', () => {
    const headers = corsHeaders(makeRequest()) as Record<string, string>;
    expect(headers['Access-Control-Max-Age']).toBe('86400');
  });
});

describe('handleOptions', () => {
  it('returns a 204 with CORS headers and no body', async () => {
    const response = handleOptions(makeRequest({ origin: 'https://x.example' }));
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://x.example');
    expect(await response.text()).toBe('');
  });
});
