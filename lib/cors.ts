/**
 * CORS helpers for the public API.
 *
 * This API is intentionally **public and credentialless**: any origin can call
 * it, no cookies or Authorization headers are read, and rate limiting (in
 * middleware.ts) is the only access control. Reflecting the request Origin is
 * therefore safe — and we deliberately do **not** emit
 * `Access-Control-Allow-Credentials: true`. Adding that header on top of an
 * Origin reflection would open a CSRF hole.
 *
 * If a future endpoint needs cookies or Authorization headers, do not generalise
 * this helper. Add a separate, allowlist-based CORS path for that route.
 */
export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function handleOptions(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
