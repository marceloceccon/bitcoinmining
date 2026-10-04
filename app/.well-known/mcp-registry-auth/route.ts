/**
 * MCP Registry HTTP authentication proof (`mcp-publisher login http`).
 * Serves the PUBLIC key line ("v=MCPv1; k=ed25519; p=<base64 public key>")
 * from the MCP_REGISTRY_AUTH environment variable. The private key never
 * touches this repo or the deployment.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const proof = process.env.MCP_REGISTRY_AUTH?.trim();
  if (!proof || !/^v=MCPv1; k=(ed25519|ecdsap384); p=[A-Za-z0-9+/=]+$/.test(proof)) {
    return new Response("Not configured\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(`${proof}\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}
