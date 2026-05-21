# Sutro dev agents

AI-editor integration for [Sutro](https://withsutro.com) backends: a **stdio MCP server** (`sutro-mcp-server` on npm) with 16 tools for projects, apps, SLang deploy/publish, and secrets, plus **SLang** reference skill and **agent instruction files** for Cursor, Claude Code, and VS Code.

This repository is a template for your team or product. It is **not** an official Sutro release — verify behavior against [docs.withsutro.com](https://docs.withsutro.com).

## Prerequisites

- **Node.js 18+**
- **Sutro security bundle** — download and extract from [console.withsutro.com](https://console.withsutro.com/). See [auth docs](https://docs.withsutro.com/docs/getting-started/auth/how-to-secure-connections).

## Setup

**1. Scaffold agent files into your project**

```bash
npx sutro-mcp-server init
```

This writes `CLAUDE.md`, `.github/copilot-instructions.md`, and `.cursor/rules/sutro.mdc` into your project root (skips any that already exist) and prints the MCP config snippet for your editor.

**2. Add the MCP server to your editor**

Paste the printed snippet into your editor's MCP config and set `SUTRO_SECURITY_BUNDLE_DIR` to your bundle path:

_Cursor / Claude Code_ (`mcpServers` block in MCP settings):
```json
{
  "mcpServers": {
    "sutro": {
      "command": "npx",
      "args": ["-y", "sutro-mcp-server"],
      "env": {
        "SUTRO_SECURITY_BUNDLE_DIR": "/path/to/your/security-bundle",
        "SUTRO_API_BASE": "https://sapi.withsutro.com"
      }
    }
  }
}
```

_VS Code_ (`settings.json`):
```json
{
  "mcp": {
    "servers": {
      "sutro": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "sutro-mcp-server"],
        "env": {
          "SUTRO_SECURITY_BUNDLE_DIR": "/path/to/your/security-bundle",
          "SUTRO_API_BASE": "https://sapi.withsutro.com"
        }
      }
    }
  }
}
```

**3. Verify**

Ask your editor to run:
1. `sutro_validate_bundle` — checks bundle files and auth readiness
2. `sutro_hello` — verifies end-to-end API connectivity

## Plugin store

**Cursor**: Install via `.cursor-plugin/plugin.json`. Skills and rules load automatically.

**Claude Code**: Install via `.claude-plugin/marketplace.json` using `/plugin marketplace add …`.

## Contents

| Path | Purpose |
| --- | --- |
| `mcp/sutro/` | Node.js **stdio MCP server** — 16 tools for projects, apps, SLang deploy, and secrets |
| `mcp/sutro/templates/` | Agent instruction files bundled with the npm package for `init` scaffolding |
| `config/` | Sample MCP snippets for Cursor, Claude Code, and VS Code |
| `skills/slang/` | Vendored **SLang** language reference from [SutroOrg/sutro-skills](https://github.com/SutroOrg/sutro-skills) |
| `skills/sutro-mcp-setup/` | Setup, env vars, JWT refresh, and extend-the-MCP-server guide |
| `rules/sutro.mdc` | Cursor rule: conventions, MCP tools, and bundle auth |
| `CLAUDE.md` | Agent instructions loaded automatically by Claude Code |
| `.github/copilot-instructions.md` | Agent instructions loaded automatically by GitHub Copilot (VS Code) |
| `.cursor-plugin/` | Cursor marketplace metadata |
| `.claude-plugin/` | Claude Code plugin + marketplace metadata |
| `vscode/` | Minimal VS Code extension: open Sutro docs from the command palette |

## MCP tools

| Tool | Purpose |
| --- | --- |
| `sutro_hello` | Calls `GET /hello` to verify credentials and connectivity |
| `sutro_validate_bundle` | Checks bundle files and auth readiness |
| `sutro_list_projects` | List projects visible to the authenticated builder |
| `sutro_list_apps` | List applications, optionally filtered by `projectId` |
| `sutro_pull_project_data` | Pull project metadata and applications for editing |
| `sutro_pull_app_for_edit` | Pull a single application with full SCode |
| `sutro_get_app` | Get application details (`includeScode=true` for full SCode) |
| `sutro_get_app_status` | Get current job/deployment status |
| `sutro_get_openapi` | Get the OpenAPI spec for an application |
| `sutro_deploy_slang` | Compile and deploy SLang (surfaces compile errors) |
| `sutro_apply_slang_changes` | Deploy, verify status, and optionally publish in one call |
| `sutro_apply_slang_from_file` | Deploy from a local file path |
| `sutro_publish_app` | Publish live; supports `versionType` and `replacePublishedVersion` |
| `sutro_list_secrets` | List secret names (values never returned) |
| `sutro_set_secret` | Add or update a secret |
| `sutro_delete_secret` | Remove a secret |

## Developing / extending

```bash
cd mcp/sutro
npm install
npm run build
```

- Add tools in `mcp/sutro/src/index.ts` using `server.registerTool(...)` and the existing `callSutro` helper.
- Update `rules/sutro.mdc`, `CLAUDE.md`, `.github/copilot-instructions.md`, and `mcp/sutro/templates/` when adding tools.

## Publishing

```bash
./scripts/release.sh          # patch bump (0.1.x → 0.1.x+1)
./scripts/release.sh minor    # minor bump (0.x.0)
./scripts/release.sh major    # major bump (x.0.0)
```

The script bumps the version in `mcp/sutro/package.json`, commits, tags, and pushes. GitHub Actions picks up the tag and runs `npm ci` → `npm run build` → `npm test` → `npm publish` via OIDC (no token needed — configured as a trusted publisher on npmjs.com).

## Updating the SLang skill

```bash
curl -fsSL "https://raw.githubusercontent.com/SutroOrg/sutro-skills/main/skills/slang/SKILL.md" \
  -o skills/slang/SKILL.md
```

## License

MIT. See [LICENSE](./LICENSE).
