import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEMPLATES_DIR = path.resolve(__dirname, "../templates");

interface ScaffoldTarget {
  templateFile: string;
  destRelative: string;
  mkdirFor?: boolean;
}

const TARGETS: ScaffoldTarget[] = [
  {
    templateFile: "CLAUDE.md",
    destRelative: "CLAUDE.md",
  },
  {
    templateFile: "copilot-instructions.md",
    destRelative: path.join(".github", "copilot-instructions.md"),
    mkdirFor: true,
  },
  {
    templateFile: "sutro.mdc",
    destRelative: path.join(".cursor", "rules", "sutro.mdc"),
    mkdirFor: true,
  },
];

const MCP_CONFIG_SNIPPET = `
Add the following to your editor's MCP configuration:

Cursor / Claude Code (mcpServers block):
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

VS Code (settings.json mcp block):
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

Replace /path/to/your/security-bundle with the directory containing your
extracted Sutro security bundle (ca.crt, mtls.crt, mtls.key, builder.jwt,
apiClient.id).

Get your security bundle at: https://console.withsutro.com/
Auth docs: https://docs.withsutro.com/docs/getting-started/auth/how-to-secure-connections
`;

export async function runInit(): Promise<void> {
  const cwd = process.cwd();
  let wroteAny = false;

  for (const target of TARGETS) {
    const src = path.join(TEMPLATES_DIR, target.templateFile);
    const dest = path.join(cwd, target.destRelative);

    if (!fs.existsSync(src)) {
      console.warn(`[sutro-mcp-server] warning: template not found: ${src}`);
      continue;
    }

    if (fs.existsSync(dest)) {
      console.log(`[sutro-mcp-server] skipped (already exists): ${target.destRelative}`);
      continue;
    }

    if (target.mkdirFor) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
    }

    fs.copyFileSync(src, dest);
    console.log(`[sutro-mcp-server] wrote: ${target.destRelative}`);
    wroteAny = true;
  }

  if (wroteAny) {
    console.log("");
  }

  console.log(MCP_CONFIG_SNIPPET);
}
