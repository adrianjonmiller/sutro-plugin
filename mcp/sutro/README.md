# sutro-mcp-server

Stdio [MCP](https://modelcontextprotocol.io) server for [Sutro](https://withsutro.com) — exposes 16 tools for projects, apps, SLang deploy/publish, and secrets to AI editors (Cursor, Claude Code, VS Code).

**Not an official Sutro release.** Verify behavior against [docs.withsutro.com](https://docs.withsutro.com).

## Requirements

- Node.js 18+
- Sutro security bundle — download and extract from [console.withsutro.com](https://console.withsutro.com/authentication). See [auth docs](https://docs.withsutro.com/docs/getting-started/auth/how-to-secure-connections).

## Quick start

```bash
npx sutro-mcp-server setup
```

Interactive setup that asks for your bundle path, validates it, detects your editor, and configures everything. If you prefer manual setup, read on.

## Manual setup

**1. Scaffold agent instruction files into your project**

```bash
npx sutro-mcp-server init
```

Writes `CLAUDE.md`, `.github/copilot-instructions.md`, and `.cursor/rules/sutro.mdc` into your project root and prints the MCP config snippet for your editor.

**2. Add the MCP server to your editor**

### Claude Code (CLI)

```bash
claude mcp add sutro \
  -e SUTRO_SECURITY_BUNDLE_DIR=/path/to/your/security-bundle \
  -- npx -y sutro-mcp-server
```

To scope the server to the current project only:

```bash
claude mcp add sutro --scope project \
  -e SUTRO_SECURITY_BUNDLE_DIR=/path/to/your/security-bundle \
  -- npx -y sutro-mcp-server
```

Verify: `claude mcp list`

### Cursor

Add to MCP settings (`mcpServers` block):

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

### VS Code

Add to `settings.json`:

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

Ask your editor to call:
- `sutro_validate_bundle` — checks bundle files and auth readiness
- `sutro_hello` — verifies end-to-end API connectivity

## Auth

The server reads a **security bundle** from `SUTRO_SECURITY_BUNDLE_DIR`. Required files:

| File | Purpose |
| --- | --- |
| `ca.crt`, `mtls.crt`, `mtls.key` | mTLS transport |
| `builder.jwt` | Bearer token (`Authorization` header) |
| `apiClient.id` | API client ID (`x-sutro-api-client` header) |

`SUTRO_API_BASE` is optional (default `https://sapi.withsutro.com`). If `builder.jwt` expires, the server refreshes it automatically using `signing.pem` or `mtls.key` plus bundle metadata.

## Tools

| Tool | Purpose |
| --- | --- |
| `sutro_hello` | Verify credentials and connectivity |
| `sutro_validate_bundle` | Check bundle files and auth readiness |
| `sutro_list_projects` | List projects visible to the authenticated builder |
| `sutro_list_apps` | List applications (optional `projectId` filter) |
| `sutro_pull_project_data` | Pull project metadata and applications |
| `sutro_pull_app_for_edit` | Pull a single application with full SCode |
| `sutro_get_app` | Get application details (`includeScode=true` for full SCode) |
| `sutro_get_app_status` | Get current deployment/job status |
| `sutro_get_openapi` | Get the OpenAPI spec for an application |
| `sutro_deploy_slang` | Compile and deploy SLang |
| `sutro_apply_slang_changes` | Deploy, verify, and optionally publish in one call |
| `sutro_apply_slang_from_file` | Deploy SLang from a local file path |
| `sutro_publish_app` | Publish live (`versionType`, `replacePublishedVersion`) |
| `sutro_list_secrets` | List secret names (values never returned) |
| `sutro_set_secret` | Add or update a secret |
| `sutro_delete_secret` | Remove a secret |

## Source

[github.com/adrianjonmiller/sutro-mcp-server](https://github.com/adrianjonmiller/sutro-mcp-server)

## License

MIT
