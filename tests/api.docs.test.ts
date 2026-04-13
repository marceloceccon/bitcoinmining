import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api-docs/route';

// ════════════════════════════════════════════════════════════════════════
// /api-docs — Scalar API reference page
// ════════════════════════════════════════════════════════════════════════

describe('GET /api-docs', () => {
  it('returns 200 with HTML content type', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/text\/html/);
  });

  it('points the api-reference element at /openapi.json', async () => {
    const response = await GET();
    const html = await response.text();
    expect(html).toContain('data-url="/openapi.json"');
  });

  it('loads the Scalar bundle from a version-pinned jsDelivr URL', async () => {
    const response = await GET();
    const html = await response.text();
    // Pinned version with explicit /dist/browser/standalone.js path
    // — the unversioned root URL is dynamically minified by jsDelivr
    // and must NOT be used because SRI cannot be applied to it.
    expect(html).toMatch(
      /https:\/\/cdn\.jsdelivr\.net\/npm\/@scalar\/api-reference@\d+\.\d+\.\d+\/dist\/browser\/standalone\.js/,
    );
  });

  it('declares an integrity (SRI) hash for the Scalar bundle', async () => {
    const response = await GET();
    const html = await response.text();
    // SRI is the defense against CDN compromise: any change to the served
    // bytes invalidates the hash and the browser refuses to execute.
    expect(html).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+"/);
  });

  it('declares crossorigin=anonymous so SRI verification can run', async () => {
    const response = await GET();
    const html = await response.text();
    expect(html).toContain('crossorigin="anonymous"');
  });

  it('emits a strict Content-Security-Policy header', async () => {
    const response = await GET();
    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('https://cdn.jsdelivr.net');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('emits security headers (X-Content-Type-Options, Referrer-Policy)', async () => {
    const response = await GET();
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('escapes HTML-significant characters in the configuration attribute', async () => {
    const response = await GET();
    const html = await response.text();
    // The config JSON contains an em dash but otherwise no HTML chars; verify
    // our escaper is invoked by checking that double quotes are escaped to &quot;
    // (JSON.stringify always emits double quotes around object keys).
    expect(html).toMatch(/data-configuration="[^"]+"/);
    // The attribute should use entity-escaped quotes (&quot;) inside, never raw "
    const match = html.match(/data-configuration="([^"]+)"/);
    expect(match).toBeTruthy();
    if (match) {
      expect(match[1]).toContain('&quot;');
      // No raw double quotes inside the attribute value
      expect(match[1]).not.toMatch(/[^&]"/);
    }
  });
});
