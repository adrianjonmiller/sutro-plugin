---
name: sutro-mcp-setup
description: Wire the local Sutro MCP server (or a hosted endpoint) into the user’s editor — env vars, config paths, and build steps for mcp/sutro.
---

# Sutro MCP setup

Use this skill when the user needs to connect **Cursor**, **Claude Code**, or **VS Code** MCP clients to Sutro tooling.

## Default (this repo): stdio stub

1. From repo root, install and build the MCP server:

   ```bash
   cd mcp/sutro && npm install && npm run build
   ```

2. Point the client at `mcp/sutro/dist/index.js` with `node` (see `config/mcp.*.sample.json`).

3. Set any API keys your implementation expects (placeholder may use none).

## Replacing the stub

- Implement Sutro HTTP API calls inside `mcp/sutro/src/index.ts` (or swap `command`/`args` to a published Sutro MCP binary).
- Add **zod** input schemas per tool; keep tool names stable so rules and docs stay accurate.
- Update `rules/sutro.mdc` and this skill with real tool names and auth.

## References

- [Sutro docs](https://docs.withsutro.com)
- [Official SLang skills](https://github.com/SutroOrg/sutro-skills)
