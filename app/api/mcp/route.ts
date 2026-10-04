import { createMcpHandler } from "mcp-handler";
import { MCP_INSTRUCTIONS, MCP_SERVER_INFO, registerMineForge } from "@/lib/mcp/server";
import { productionDeps } from "@/lib/mcp/deps";

/**
 * MineForge MCP server — public, read-only, stateless Streamable HTTP.
 * Serves the 2026-07-28 protocol and 2025-era clients from one handler.
 * Rate-limited per IP by middleware.ts like every /api route.
 */
const handler = createMcpHandler((server) => registerMineForge(server, productionDeps), {
  serverInfo: MCP_SERVER_INFO,
  instructions: MCP_INSTRUCTIONS,
});

export const maxDuration = 30;
export { handler as GET, handler as POST };
