---
name: sutro-mcp-setup
description: Wire the local Sutro MCP server into the user’s editor — security bundle path, env vars, build steps for mcp/sutro.
---

# Sutro MCP setup

Use this skill when the user needs to connect **Cursor**, **Claude Code**, or **VS Code** MCP clients to Sutro tooling.

## Prerequisites

- Download **security-bundle.zip** from [Sutro Console](https://console.withsutro.com/) and extract it to a stable directory (for example `~/.config/sutro/security-bundle`). Do not commit the bundle; it contains private keys and JWTs.
- For production-style auth (sign your own Builder JWT), see [How to secure connections](https://docs.withsutro.com/docs/getting-started/auth/how-to-secure-connections).

## Build the MCP server

From the repo root:

```bash
cd mcp/sutro && npm install && npm run build
```

## Configure the client

1. Point **command** / **args** at `mcp/sutro/dist/index.js` with `node` (see `config/mcp.cursor-sample.json`, `config/mcp.vscode-sample.json`, `config/mcp.claude-sample.json`).
2. Set **`SUTRO_SECURITY_BUNDLE_DIR`** to the directory that contains `ca.crt`, `mtls.crt`, `mtls.key`, `builder.jwt`, and `apiClient.id`. Use an **absolute** path in MCP `env` if your client does not expand `~`. A leading `~/` in the value is expanded by the server using `$HOME`.
3. Optionally set **`SUTRO_API_BASE`** (default `https://sapi.withsutro.com`).

## Verify

Use **`sutro_validate_bundle`** first to check local bundle readiness (required files + JWT refresh prerequisites), then run **`sutro_hello`** (calls `GET /hello`) to verify end-to-end connectivity.

## Refresh `builder.jwt` locally (optional)

If the bundle’s **`builder.jwt`** expired but you still have a signing key (**`signing.pem`** preferred, fallback **`mtls.key`**) and the correct **issuer** + **builder `sub`**, you can mint a short-lived token without pasting passwords into chat:

1. Copy [`mcp/sutro/.env.example`](mcp/sutro/.env.example) to **`mcp/sutro/.env`** (never commit `.env`).
2. Set `SUTRO_SECURITY_BUNDLE_DIR`, `SUTRO_PROVISION_MODE=sign-only`. Ensure `jwtIssuer.id` and either `.sutro-builder-sid` or `builder.id` (or `SUTRO_BUILDER_SID`) match what Sutro expects for `iss` / `sub` on the Builder JWT ([How to secure connections](https://docs.withsutro.com/docs/getting-started/auth/how-to-secure-connections)).
3. From `mcp/sutro`: `npm install` then `node --env-file=.env scripts/sutro-provision-from-env.mjs` (or `npm run sutro-provision` with the same env loaded).

For a **full** org init + new builder (only when your org can run `/initialization`), set `SUTRO_PROVISION_MODE=full` plus `SUTRO_ORG_EMAIL`, `SUTRO_ORG_PASSWORD`, `SUTRO_COMMON_NAME`, and `SUTRO_JWT_ISSUER` per the doc.

## Adding more tools

- Implement additional Sutro HTTP calls via the same bundle auth pattern in `mcp/sutro/src/`; keep tool names stable and extend `rules/sutro.mdc` when you add tools.
- Use **zod** input schemas per tool.

## References

- [Sutro docs](https://docs.withsutro.com)
- [Official SLang skills](https://github.com/SutroOrg/sutro-skills)
