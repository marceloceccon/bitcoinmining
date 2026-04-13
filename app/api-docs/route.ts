/**
 * Standalone HTML page that mounts Scalar's API reference UI against /openapi.json.
 *
 * The Scalar bundle is loaded from jsDelivr at a pinned version with a Subresource
 * Integrity (SRI) hash so that a CDN compromise or accidental file substitution at
 * the same path cannot inject arbitrary code into our docs page. To upgrade:
 *
 *   1. Choose the new version: see https://www.npmjs.com/package/@scalar/api-reference
 *   2. Compute the SRI hash for the unminified standalone bundle (jsDelivr will
 *      auto-minify the package root, which is incompatible with SRI — always use
 *      the explicit /dist/browser/standalone.js path):
 *
 *        curl -sL "https://cdn.jsdelivr.net/npm/@scalar/api-reference@<version>/dist/browser/standalone.js" \
 *          | openssl dgst -sha384 -binary | openssl base64 -A
 *
 *   3. Update SCALAR_VERSION and SCALAR_SRI below.
 */
const SCALAR_VERSION = '1.52.1';
const SCALAR_SRI = 'sha384-mf6gxVzEDU/HNmr0o4taUchYTK9MzpkZLQsEmEGNJFyp2Cb+k6ilAOVAFCRj1Z4R';
const SCALAR_URL = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}/dist/browser/standalone.js`;

const SCALAR_CONFIG = {
  theme: 'default',
  metaData: {
    title: 'Bitcoin Mining Farm Calculator — API Reference',
    description:
      'Free API for Bitcoin mining profitability calculations, hardware catalogs, and multi-year forecasts.',
  },
};

/**
 * Escape a string for safe embedding inside an HTML attribute value.
 * Belt-and-braces: even though everything we embed is currently static, the
 * helper makes the page robust if a future maintainer wires user-controlled
 * config in here.
 */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function GET() {
  const configAttr = escapeHtmlAttr(JSON.stringify(SCALAR_CONFIG));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Reference — Bitcoin Mining Farm Calculator</title>
  <meta name="description" content="Free API for Bitcoin mining profitability calculations, hardware catalogs, and multi-year forecasts." />
</head>
<body>
  <script
    id="api-reference"
    data-url="/openapi.json"
    data-configuration="${configAttr}"
  ></script>
  <script
    src="${SCALAR_URL}"
    integrity="${SCALAR_SRI}"
    crossorigin="anonymous"
    referrerpolicy="no-referrer"
  ></script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Strict CSP: only same-origin assets, except the pinned & SRI-checked Scalar bundle.
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
