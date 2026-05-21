# Sutro dev agents — agent instructions

**Not affiliated**: This plugin bundle is a community/dev-agents template. Official Sutro docs live at [docs.withsutro.com](https://docs.withsutro.com).

## MCP server setup

The `mcp/sutro` stdio MCP server must be built before use:

```bash
cd mcp/sutro && npm install && npm run build
```

Point your MCP client at `mcp/sutro/dist/index.js` using the sample config in `config/mcp.claude-sample.json`. Replace `/ABSOLUTE/PATH/TO/sutro-dev-agents` with your clone path and set `SUTRO_SECURITY_BUNDLE_DIR` to the directory containing your extracted security bundle.

## MCP auth

The server reads a **security bundle** from `SUTRO_SECURITY_BUNDLE_DIR`. Required files:

- `ca.crt`, `mtls.crt`, `mtls.key` — mTLS transport
- `builder.jwt` — Bearer token (`Authorization` header)
- `apiClient.id` — API client identifier (`x-sutro-api-client` header)

Optional: `SUTRO_API_BASE` (default `https://sapi.withsutro.com`).

If `builder.jwt` is stale, the server can refresh it automatically using `signing.pem` (preferred) or `mtls.key` plus issuer/subject metadata in the bundle. Never print JWTs, private keys, or PEMs in tool output or responses.

Run `sutro_validate_bundle` first to check bundle readiness, then `sutro_hello` to verify end-to-end connectivity.

## SLang

Use the `skills/slang/SKILL.md` reference (vendored from [SutroOrg/sutro-skills](https://github.com/SutroOrg/sutro-skills)) for SLang syntax and patterns. Prefer `.slang` files when defining backends; align edits with Sutro Studio or the Sutro API when the user's workflow uses those.

## Shape-first workflow

Treat live API responses as source-of-truth when docs drift. Use `npm run sutro-probe-shapes` in `mcp/sutro` to capture endpoint status and top-level payload shapes, then align parsers/normalizers in `mcp/sutro/src/` accordingly.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `sutro_hello` | Calls `GET /hello` to verify bundle credentials and connectivity |
| `sutro_validate_bundle` | Checks bundle files/metadata and verifies auth-readiness before API calls |
| `sutro_list_projects` | List all projects visible to the authenticated builder |
| `sutro_list_apps` | List applications, optionally filtered by `projectId` |
| `sutro_pull_project_data` | Pull project metadata plus project applications for editing workflows |
| `sutro_pull_app_for_edit` | Pull a single application with full SCode for editing context |
| `sutro_get_app` | Get application details; pass `includeScode=true` for full SCode |
| `sutro_get_app_status` | Get current job/deployment status for an application |
| `sutro_get_openapi` | Get the OpenAPI spec for an application |
| `sutro_deploy_slang` | Compile SLang and update an application (surfaces compile errors) |
| `sutro_apply_slang_changes` | Deploy SLang, verify status, and optionally publish in one tool call |
| `sutro_apply_slang_from_file` | Read SLang from local file path and run deploy/verify/(optional publish) |
| `sutro_publish_app` | Publish an application live; supports `versionType` and `replacePublishedVersion` |
| `sutro_list_secrets` | List secret names configured on an application (values never returned) |
| `sutro_set_secret` | Add or update a secret on an application |
| `sutro_delete_secret` | Remove a secret from an application |

## Edit and ship workflow

1. Use `sutro_list_projects` and `sutro_list_apps` for discovery (`includeScode=false` by default for lighter payloads).
2. Use `sutro_pull_project_data` or `sutro_pull_app_for_edit` when you need full SCode context before making changes.
3. Apply changes with `sutro_deploy_slang`, or use `sutro_apply_slang_changes` for deploy + status verification (+ optional publish) in one call.
4. For release workflows, publish options include `versionType` and `replacePublishedVersion`.
5. If the SLang file is already on disk, use `sutro_apply_slang_from_file` to avoid sending large inline payloads through tool arguments.

## References

- [Sutro docs](https://docs.withsutro.com)
- [Official SLang skills](https://github.com/SutroOrg/sutro-skills)
- SLang reference: `skills/slang/SKILL.md`
- MCP setup detail: `skills/sutro-mcp-setup/SKILL.md`
