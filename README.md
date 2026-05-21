# Sutro dev agents

AI-editor integration for [Sutro](https://withsutro.com) backends: a **stdio MCP server** with 16 tools for projects, apps, SLang deploy/publish, and secrets, plus **SLang** reference skill and **agent instruction files** for Cursor, Claude Code, and VS Code.

This repository is a template for your team or product. It is **not** an official Sutro release — verify behavior against [docs.withsutro.com](https://docs.withsutro.com).

## Prerequisites

- **Node.js 18+**
- **Sutro security bundle** extracted to a directory on disk — get it from [console.withsutro.com](https://console.withsutro.com/). See [auth docs](https://docs.withsutro.com/docs/getting-started/auth/how-to-secure-connections) for details.

## Quick start (any editor)

```bash
# In your project root:
npx sutro-mcp-server init
```

This scaffolds `CLAUDE.md`, `.github/copilot-instructions.md`, and `.cursor/rules/sutro.mdc` into your project and prints the MCP config snippet to paste into your editor.

Then set `SUTRO_SECURITY_BUNDLE_DIR` in the printed config to your extracted bundle path and add the snippet to your editor's MCP settings.

Verify the connection:

1. Run `sutro_validate_bundle` — checks bundle files and auth readiness
2. Run `sutro_hello` — verifies end-to-end API connectivity

## Plugin store

**Cursor**: Install via `.cursor-plugin/plugin.json`. Skills and rules load automatically from the plugin directory.

**Claude Code**: Install via `.claude-plugin/marketplace.json` using `/plugin marketplace add …`. `CLAUDE.md` provides agent instructions automatically.

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
| `assets/logo.svg` | Plugin logo |

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

1. Edit `mcp/sutro/src/index.ts` and register new tools with `server.registerTool(...)`.
2. Call Sutro's HTTP API from each handler using the existing `callSutro` helper; use `zod` for inputs.
3. Update `rules/sutro.mdc`, `CLAUDE.md`, `.github/copilot-instructions.md`, and `mcp/sutro/templates/` with new tool names.
4. Run `npm run build` in `mcp/sutro` after changes.

## Publishing to npm

```bash
cd mcp/sutro
npm publish
```

`prepublishOnly` runs `tsc` automatically. The `dist/` and `templates/` directories are included in the tarball.

## Updating the SLang skill

Upstream: [github.com/SutroOrg/sutro-skills](https://github.com/SutroOrg/sutro-skills)

```bash
curl -fsSL "https://raw.githubusercontent.com/SutroOrg/sutro-skills/main/skills/slang/SKILL.md" \
  -o skills/slang/SKILL.md
```

## License

MIT. See [LICENSE](./LICENSE).
