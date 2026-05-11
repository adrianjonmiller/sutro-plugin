# Sutro dev agents

Bundled pieces to work on [Sutro](https://withsutro.com) backends from **Cursor**, **Claude Code**, and **VS Code**: a small **stdio MCP** server (bundle auth + `sutro_hello`), **SLang** reference skill (vendored from upstream), a **setup** skill, **rules**, and **sample MCP configs**.

This repository is a template for your team or product. It is **not** an official Sutro release—verify behavior against [docs.withsutro.com](https://docs.withsutro.com).

## Contents

| Path | Purpose |
| --- | --- |
| `mcp/sutro` | Node.js **stdio MCP** server. Uses `SUTRO_SECURITY_BUNDLE_DIR` (mTLS + JWT) and exposes `sutro_hello` (`GET /hello`). Add more tools in `src/`. |
| `config/` | Sample MCP snippets for Cursor, Claude Code, and VS Code (`mcp.*.sample.json`). |
| `skills/slang/` | Vendored **SLang** language reference from [SutroOrg/sutro-skills](https://github.com/SutroOrg/sutro-skills) (`skills/slang/SKILL.md`). Refresh periodically. |
| `skills/sutro-mcp-setup/` | How to build, wire env vars, and extend the MCP server. |
| `rules/sutro.mdc` | Cursor rule: conventions, MCP tools, and bundle auth. Copy into `.cursor/rules/` or enable for your plugin distribution. |
| `.cursor-plugin/` | Cursor marketplace metadata. |
| `.claude-plugin/` | Claude Code plugin + marketplace metadata. |
| `vscode/` | Minimal VS Code extension: open Sutro docs from the command palette. |
| `assets/logo.svg` | Plugin logo. |

## Prerequisites

- **Node.js 18+** (for `mcp/sutro`).
- **Sutro security bundle** extracted to a directory on disk; set **`SUTRO_SECURITY_BUNDLE_DIR`** in MCP `env` (see `config/mcp.*.sample.json`). Optional **`SUTRO_API_BASE`** (default `https://sapi.withsutro.com`).

## Build the MCP server

```bash
cd mcp/sutro
npm install
npm run build
```

The runnable entrypoint is `mcp/sutro/dist/index.js`.

## Cursor

1. Merge `config/mcp.cursor-sample.json` into your **Cursor MCP** configuration (project or user), or paste the `sutro` block from the sample.
2. Adjust `args` to an **absolute path** if `${workspaceFolder}` is not supported in your Cursor version.
3. Set **`SUTRO_SECURITY_BUNDLE_DIR`** to your extracted bundle path (absolute path recommended).
4. Add **`rules/sutro.mdc`** under `.cursor/rules/` if you want it applied (set `alwaysApply` in the frontmatter if desired).
5. Install or reference this repo as a **Cursor plugin** using `.cursor-plugin/plugin.json` when publishing.

## Claude Code

1. Open `config/mcp.claude-sample.json` and replace `/ABSOLUTE/PATH/TO/sutro-dev-agents` with your clone path.
2. Merge the `mcpServers.sutro` entry into Claude Code’s MCP config for your environment.
3. Install the plugin via `.claude-plugin/` and `marketplace.json` if you run a marketplace (`/plugin marketplace add …`).

## VS Code

1. **MCP**: If your build of VS Code exposes MCP settings, merge the structure in `config/mcp.vscode-sample.json` into **User** or **Workspace** settings. Keys and nesting differ by version and extension—align with your editor’s current MCP docs if the sample does not validate.
2. **Extension** (optional): open this folder’s `vscode/` in VS Code and run **Extensions: Install Extension from Location…**, or package with `@vscode/vsce` for the Marketplace / Open VSX.

Commands contributed:

- **Sutro: Open documentation**
- **Sutro: Open SLang introduction**

## Developing real Sutro tools

1. Edit `mcp/sutro/src/index.ts` and register tools with `server.registerTool(...)`.
2. Call Sutro’s **HTTP API** (or a future hosted MCP URL) from each handler; use `zod` for inputs.
3. Update `rules/sutro.mdc` and `README.md` with tool names and required env vars.
4. Re-run `npm run build` in `mcp/sutro` after changes.

## Updating the SLang skill

Upstream: [github.com/SutroOrg/sutro-skills](https://github.com/SutroOrg/sutro-skills) (path `skills/slang/SKILL.md` in that repo).

```bash
curl -fsSL "https://raw.githubusercontent.com/SutroOrg/sutro-skills/main/skills/slang/SKILL.md" \
  -o skills/slang/SKILL.md
```

## License

MIT. See [LICENSE](./LICENSE).
