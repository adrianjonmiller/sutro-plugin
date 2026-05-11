import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  callSutro,
  loadCredentials,
  redactForErrorMessage,
  resolveApiBase,
  resolveBundleDir,
  sutroRequest,
} from "./sutroClient.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function okResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function errResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    isError: true,
  };
}

async function runTool(
  fn: () => Promise<ReturnType<typeof okResult>>,
): Promise<ReturnType<typeof okResult> | ReturnType<typeof errResult>> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errResult({ ok: false, error: redactForErrorMessage(msg) });
  }
}

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
  "sutro_hello",
  {
    description:
      "Verify Sutro API connectivity using the security bundle (mTLS + Builder JWT). Calls GET /hello on the configured API base.",
    inputSchema: z.object({
      includeRaw: z
        .boolean()
        .optional()
        .describe("If true, include raw response body text in the output"),
    }),
  },
  async ({ includeRaw }) => {
    const bundleDir = resolveBundleDir();
    if (!bundleDir) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: false,
                error: "SUTRO_SECURITY_BUNDLE_DIR is not set",
                hint: "Set env SUTRO_SECURITY_BUNDLE_DIR to the directory containing ca.crt, mtls.crt, mtls.key, builder.jwt, and apiClient.id (absolute path recommended).",
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    try {
      const creds = loadCredentials(bundleDir);
      const apiBase = resolveApiBase();
      const { statusCode, bodyText } = await sutroRequest(creds, apiBase, {
        method: "GET",
        path: "/hello",
      });

      if (statusCode < 200 || statusCode >= 300) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  statusCode,
                  message: "Sutro /hello returned a non-success status",
                  bodyPreview: redactForErrorMessage(bodyText).slice(0, 500),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(bodyText) as unknown;
      } catch {
        parsed = null;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                statusCode,
                apiBase,
                summary: parsed ?? bodyText,
                ...(includeRaw ? { raw: bodyText } : {}),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: false,
                error: redactForErrorMessage(msg),
                bundleDir,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "sutro_validate_bundle",
  {
    description:
      "Validate the configured Sutro security bundle and report readiness for authenticated MCP calls.",
    inputSchema: z.object({}),
  },
  async () => {
    const bundleDir = resolveBundleDir();
    if (!bundleDir) {
      return errResult({
        ok: false,
        error: "SUTRO_SECURITY_BUNDLE_DIR is not set",
        hint: "Set env SUTRO_SECURITY_BUNDLE_DIR to your extracted security bundle path.",
      });
    }

    const exists = (name: string) => fs.existsSync(path.join(bundleDir, name));
    const requiredFiles = ["ca.crt", "mtls.crt", "mtls.key", "apiClient.id"];
    const missingRequired = requiredFiles.filter((name) => !exists(name));

    const hasIssuer = exists("jwtIssuer.id");
    const hasBuilderSub =
      Boolean(process.env.SUTRO_BUILDER_SID?.trim()) ||
      exists(".sutro-builder-sid") ||
      exists("builder.id");
    const hasSigningKey = exists("signing.pem") || exists("mtls.key");

    const metadataIssues: string[] = [];
    if (!hasIssuer) metadataIssues.push('Missing "jwtIssuer.id"');
    if (!hasBuilderSub) {
      metadataIssues.push(
        'Missing builder subject: set SUTRO_BUILDER_SID or add ".sutro-builder-sid"/"builder.id"',
      );
    }
    if (!hasSigningKey) {
      metadataIssues.push('Missing signing key: expected "signing.pem" or "mtls.key"');
    }

    if (missingRequired.length > 0 || metadataIssues.length > 0) {
      return errResult({
        ok: false,
        bundleDir,
        apiBase: resolveApiBase(),
        missingRequiredFiles: missingRequired,
        metadataIssues,
      });
    }

    try {
      // Also exercises auto-refresh path for builder.jwt.
      loadCredentials(bundleDir);
      return okResult({
        ok: true,
        bundleDir,
        apiBase: resolveApiBase(),
        filesChecked: requiredFiles,
        refreshSupport: "enabled (signing.pem preferred, mtls.key fallback)",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return errResult({
        ok: false,
        bundleDir,
        apiBase: resolveApiBase(),
        error: redactForErrorMessage(msg),
      });
    }
  },
);

// ---------------------------------------------------------------------------
// Discovery tools
// ---------------------------------------------------------------------------

server.registerTool(
  "sutro_list_projects",
  {
    description: "List all Sutro projects visible to the authenticated builder.",
    inputSchema: z.object({}),
  },
  async () =>
    runTool(async () => {
      const { statusCode, json } = await callSutro({
        method: "GET",
        path: "/projects",
      });
      if (statusCode < 200 || statusCode >= 300) {
        return errResult({ ok: false, statusCode, response: json });
      }
      const data = json as { items?: unknown[]; metadata?: unknown };
      return okResult({ ok: true, statusCode, projects: data.items ?? [], metadata: data.metadata });
    }),
);

server.registerTool(
  "sutro_list_apps",
  {
    description:
      "List all Sutro applications visible to the authenticated builder, optionally filtered by project.",
    inputSchema: z.object({
      projectId: z
        .string()
        .uuid()
        .optional()
        .describe("Filter applications to a specific project ID"),
    }),
  },
  async ({ projectId }) =>
    runTool(async () => {
      const path = projectId
        ? `/projects/${projectId}/applications`
        : "/applications";
      const { statusCode, json } = await callSutro({ method: "GET", path });
      if (statusCode < 200 || statusCode >= 300) {
        return errResult({ ok: false, statusCode, response: json });
      }
      const data = json as { items?: unknown[]; metadata?: unknown };
      return okResult({ ok: true, statusCode, applications: data.items ?? [], metadata: data.metadata });
    }),
);

server.registerTool(
  "sutro_get_app",
  {
    description:
      "Get details for a specific Sutro application. Set includeScode=true to include the full SCode definition.",
    inputSchema: z.object({
      applicationId: z.string().uuid().describe("The application UUID"),
      includeScode: z
        .boolean()
        .optional()
        .describe(
          "Include the full SCode definition in the response (default false)",
        ),
    }),
  },
  async ({ applicationId, includeScode }) =>
    runTool(async () => {
      const { statusCode, json } = await callSutro({
        method: "GET",
        path: `/applications/${applicationId}`,
      });
      if (statusCode < 200 || statusCode >= 300) {
        return errResult({ ok: false, statusCode, response: json });
      }
      const app = json as Record<string, unknown>;
      if (!includeScode) {
        const { scode: _scode, ...rest } = app;
        return okResult({ ok: true, statusCode, application: rest });
      }
      return okResult({ ok: true, statusCode, application: app });
    }),
);

server.registerTool(
  "sutro_get_app_status",
  {
    description:
      "Get the current job/deployment status for a Sutro application.",
    inputSchema: z.object({
      applicationId: z.string().uuid().describe("The application UUID"),
    }),
  },
  async ({ applicationId }) =>
    runTool(async () => {
      const { statusCode, json } = await callSutro({
        method: "GET",
        path: `/applications/${applicationId}/status`,
      });
      if (statusCode < 200 || statusCode >= 300) {
        return errResult({ ok: false, statusCode, response: json });
      }
      return okResult({ ok: true, statusCode, status: json });
    }),
);

server.registerTool(
  "sutro_get_openapi",
  {
    description: "Get the OpenAPI specification for a Sutro application.",
    inputSchema: z.object({
      applicationId: z.string().uuid().describe("The application UUID"),
    }),
  },
  async ({ applicationId }) =>
    runTool(async () => {
      const { statusCode, json, bodyText } = await callSutro({
        method: "GET",
        path: `/applications/${applicationId}/openapi`,
      });
      if (statusCode < 200 || statusCode >= 300) {
        return errResult({ ok: false, statusCode, response: json });
      }
      return okResult({ ok: true, statusCode, spec: json ?? bodyText });
    }),
);

// ---------------------------------------------------------------------------
// Deploy / publish tools
// ---------------------------------------------------------------------------

server.registerTool(
  "sutro_deploy_slang",
  {
    description:
      "Compile SLang source and update a Sutro application. Returns the updated application or compile errors on failure.",
    inputSchema: z.object({
      applicationId: z.string().uuid().describe("The application UUID"),
      slang: z.string().describe("SLang source code to compile and deploy"),
    }),
  },
  async ({ applicationId, slang }) =>
    runTool(async () => {
      const { statusCode, json } = await callSutro({
        method: "PUT",
        path: `/applications/${applicationId}/slang`,
        body: { slang },
      });
      if (statusCode === 400) {
        return errResult({
          ok: false,
          statusCode,
          error: "SLang compile error",
          details: json,
        });
      }
      if (statusCode < 200 || statusCode >= 300) {
        return errResult({ ok: false, statusCode, response: json });
      }
      const app = json as Record<string, unknown>;
      const { scode: _scode, ...summary } = app;
      return okResult({ ok: true, statusCode, application: summary });
    }),
);

server.registerTool(
  "sutro_publish_app",
  {
    description:
      "Publish a Sutro application to make it live. Optionally bump the version.",
    inputSchema: z.object({
      applicationId: z.string().uuid().describe("The application UUID"),
      versionType: z
        .enum(["major", "minor", "patch"])
        .optional()
        .describe("Version bump type (default: patch)"),
    }),
  },
  async ({ applicationId, versionType }) =>
    runTool(async () => {
      const body: Record<string, unknown> = {};
      if (versionType) body.versionType = versionType;
      const { statusCode, json } = await callSutro({
        method: "POST",
        path: `/applications/${applicationId}/publish`,
        body,
      });
      if (statusCode < 200 || statusCode >= 300) {
        return errResult({ ok: false, statusCode, response: json });
      }
      return okResult({ ok: true, statusCode, result: json });
    }),
);

// ---------------------------------------------------------------------------
// Secrets tools
// ---------------------------------------------------------------------------

server.registerTool(
  "sutro_list_secrets",
  {
    description: "List the secret names configured for a Sutro application. Secret values are never returned.",
    inputSchema: z.object({
      applicationId: z.string().uuid().describe("The application UUID"),
    }),
  },
  async ({ applicationId }) =>
    runTool(async () => {
      const { statusCode, json } = await callSutro({
        method: "GET",
        path: `/applications/${applicationId}/secrets`,
      });
      if (statusCode < 200 || statusCode >= 300) {
        return errResult({ ok: false, statusCode, response: json });
      }
      const data = json as { items?: unknown[]; metadata?: unknown };
      return okResult({ ok: true, statusCode, secrets: data.items ?? [], metadata: data.metadata });
    }),
);

server.registerTool(
  "sutro_set_secret",
  {
    description: "Add or update a secret on a Sutro application.",
    inputSchema: z.object({
      applicationId: z.string().uuid().describe("The application UUID"),
      name: z.string().describe("Secret name"),
      value: z.string().describe("Secret value"),
    }),
  },
  async ({ applicationId, name, value }) =>
    runTool(async () => {
      const { statusCode, json } = await callSutro({
        method: "POST",
        path: `/applications/${applicationId}/secrets`,
        body: { name, value },
      });
      if (statusCode < 200 || statusCode >= 300) {
        return errResult({ ok: false, statusCode, response: json });
      }
      return okResult({ ok: true, statusCode, name });
    }),
);

server.registerTool(
  "sutro_delete_secret",
  {
    description: "Remove a secret from a Sutro application.",
    inputSchema: z.object({
      applicationId: z.string().uuid().describe("The application UUID"),
      name: z.string().describe("Name of the secret to delete"),
    }),
  },
  async ({ applicationId, name }) =>
    runTool(async () => {
      const { statusCode, json } = await callSutro({
        method: "DELETE",
        path: `/applications/${applicationId}/secrets/${encodeURIComponent(name)}`,
      });
      if (statusCode < 200 || statusCode >= 300) {
        return errResult({ ok: false, statusCode, response: json });
      }
      return okResult({ ok: true, statusCode, name });
    }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
