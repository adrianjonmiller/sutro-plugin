import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer(
  {
    name: "sutro-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.registerTool(
  "sutro_placeholder",
  {
    description:
      "Placeholder tool until Sutro HTTP API or hosted MCP is wired. Verifies the MCP server runs.",
    inputSchema: z.object({
      message: z.string().optional().describe("Optional string echoed back"),
    }),
  },
  async ({ message }) => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: true,
              echo: message ?? null,
              nextSteps: [
                "Implement Sutro API clients in mcp/sutro/src/index.ts",
                "Register tools with stable names; update rules/sutro.mdc",
                "Set SUTRO_API_KEY (or your chosen env var) when auth is required",
              ],
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
