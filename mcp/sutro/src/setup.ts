import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { execSync } from "node:child_process";

const CONSOLE_URL = "https://console.withsutro.com/";
const AUTH_DOCS_URL =
  "https://docs.withsutro.com/docs/getting-started/auth/how-to-secure-connections";
const DEFAULT_API_BASE = "https://sapi.withsutro.com";

const REQUIRED_FILES = ["ca.crt", "mtls.crt", "mtls.key", "apiClient.id"];
const AUTH_FILES = ["builder.jwt"];

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(process.env.HOME ?? "", p.slice(2));
  }
  return p;
}

function validateBundle(bundleDir: string): {
  ok: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(bundleDir, file))) {
      missing.push(file);
    }
  }

  for (const file of AUTH_FILES) {
    if (!fs.existsSync(path.join(bundleDir, file))) {
      warnings.push(
        `${file} not found — the server can auto-generate it if signing.pem and jwtIssuer.id are present`,
      );
    }
  }

  return { ok: missing.length === 0, missing, warnings };
}

function detectEditors(): { claude: boolean; cursor: boolean; vscode: boolean } {
  const hasCmd = (cmd: string) => {
    try {
      execSync(`command -v ${cmd}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  };
  return {
    claude: hasCmd("claude"),
    cursor: hasCmd("cursor"),
    vscode: hasCmd("code"),
  };
}

function installForClaude(bundleDir: string, scope: string): boolean {
  const args = [
    "mcp", "add", "sutro",
    "--scope", scope,
    "-e", `SUTRO_SECURITY_BUNDLE_DIR=${bundleDir}`,
    "--", "npx", "-y", "sutro-mcp-server",
  ];
  try {
    execSync(`claude ${args.join(" ")}`, { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

export async function runSetup(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("");
  console.log("  Sutro MCP Server Setup");
  console.log("  ----------------------");
  console.log("");

  // Step 1 — ask for bundle path
  const bundleInput = await rl.question(
    `  Where is your Sutro security bundle located?\n` +
    `  (If you don't have one, get it at ${CONSOLE_URL})\n\n` +
    `  Bundle path: `,
  );

  if (!bundleInput.trim()) {
    console.log("\n  No path provided. Exiting.\n");
    rl.close();
    process.exit(1);
  }

  const bundleDir = path.resolve(expandHome(bundleInput.trim()));

  if (!fs.existsSync(bundleDir)) {
    console.log(`\n  Directory not found: ${bundleDir}`);
    console.log(`  Download your bundle at: ${CONSOLE_URL}`);
    console.log(`  Auth docs: ${AUTH_DOCS_URL}\n`);
    rl.close();
    process.exit(1);
  }

  if (!fs.statSync(bundleDir).isDirectory()) {
    console.log(`\n  Path is not a directory: ${bundleDir}\n`);
    rl.close();
    process.exit(1);
  }

  // Step 2 — validate
  const result = validateBundle(bundleDir);

  if (!result.ok) {
    console.log(`\n  Bundle validation failed.`);
    console.log(`  Missing required files: ${result.missing.join(", ")}`);
    console.log(`\n  Expected files in your bundle directory:`);
    console.log(`    ${[...REQUIRED_FILES, ...AUTH_FILES].join(", ")}`);
    console.log(`\n  Download a fresh bundle at: ${CONSOLE_URL}`);
    console.log(`  Auth docs: ${AUTH_DOCS_URL}\n`);
    rl.close();
    process.exit(1);
  }

  console.log(`\n  Bundle validated — all required files present.`);

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.log(`  Warning: ${w}`);
    }
  }

  // Step 3 — detect editors and install
  const editors = detectEditors();
  console.log("");

  if (editors.claude) {
    const answer = await rl.question(
      `  Claude Code CLI detected. Add the MCP server now? (Y/n): `,
    );
    if (answer.trim().toLowerCase() !== "n") {
      const scope = await rl.question(
        `  Scope? (user = all projects, project = this project only) [user]: `,
      );
      const resolvedScope =
        scope.trim().toLowerCase() === "project" ? "project" : "user";

      console.log("");
      const ok = installForClaude(bundleDir, resolvedScope);
      if (ok) {
        console.log(`\n  Added to Claude Code (scope: ${resolvedScope}).`);
        console.log(`  Verify with: claude mcp list\n`);
      } else {
        console.log(`\n  Could not add automatically. Run manually:`);
        console.log(`  claude mcp add sutro \\`);
        console.log(`    -e SUTRO_SECURITY_BUNDLE_DIR=${bundleDir} \\`);
        console.log(`    -- npx -y sutro-mcp-server\n`);
      }
    }
  }

  // Always show config for other editors
  if (!editors.claude || editors.cursor || editors.vscode) {
    const showOther = editors.claude
      ? (
          await rl.question(
            `  Show config snippets for other editors? (y/N): `,
          )
        )
          .trim()
          .toLowerCase() === "y"
      : true;

    if (showOther) {
      console.log("");
      if (editors.cursor || !editors.claude) {
        console.log(`  Cursor / Claude Code (mcpServers block):`);
        console.log(`  ${JSON.stringify(
          {
            mcpServers: {
              sutro: {
                command: "npx",
                args: ["-y", "sutro-mcp-server"],
                env: {
                  SUTRO_SECURITY_BUNDLE_DIR: bundleDir,
                  SUTRO_API_BASE: DEFAULT_API_BASE,
                },
              },
            },
          },
          null,
          2,
        ).split("\n").join("\n  ")}`);
        console.log("");
      }

      if (editors.vscode || !editors.claude) {
        console.log(`  VS Code (settings.json):`);
        console.log(`  ${JSON.stringify(
          {
            mcp: {
              servers: {
                sutro: {
                  type: "stdio",
                  command: "npx",
                  args: ["-y", "sutro-mcp-server"],
                  env: {
                    SUTRO_SECURITY_BUNDLE_DIR: bundleDir,
                    SUTRO_API_BASE: DEFAULT_API_BASE,
                  },
                },
              },
            },
          },
          null,
          2,
        ).split("\n").join("\n  ")}`);
        console.log("");
      }
    }
  }

  console.log(`  Done! After adding the server, verify by asking your editor to run:`);
  console.log(`    1. sutro_validate_bundle — checks bundle and auth readiness`);
  console.log(`    2. sutro_hello — verifies end-to-end API connectivity`);
  console.log("");

  rl.close();
}
