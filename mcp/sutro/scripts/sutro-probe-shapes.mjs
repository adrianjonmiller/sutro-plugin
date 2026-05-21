#!/usr/bin/env node
/**
 * Read-only shape probe for Sutro endpoints.
 *
 * Usage:
 *   node scripts/sutro-probe-shapes.mjs
 *   node scripts/sutro-probe-shapes.mjs --timeout-ms=10000
 *   node scripts/sutro-probe-shapes.mjs --project-id=<uuid>
 *   node scripts/sutro-probe-shapes.mjs --snapshot=./tmp/sutro-shapes.json
 */

import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import process from "node:process";
import tls from "node:tls";

const DEFAULT_API_BASE = "https://sapi.withsutro.com";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_PROJECT_ID = "257deb69-c503-4777-822d-96dcd53c7c3a";

function parseArgs(argv) {
  const out = {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    projectId: DEFAULT_PROJECT_ID,
    snapshotPath: "",
  };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--timeout-ms=")) {
      const n = Number(arg.split("=")[1]);
      if (Number.isFinite(n) && n > 0) out.timeoutMs = n;
      continue;
    }
    if (arg.startsWith("--project-id=")) {
      out.projectId = arg.split("=")[1] || out.projectId;
      continue;
    }
    if (arg.startsWith("--snapshot=")) {
      out.snapshotPath = arg.split("=")[1] || "";
    }
  }

  return out;
}

function resolveBundleDir() {
  const raw = process.env.SUTRO_SECURITY_BUNDLE_DIR?.trim();
  if (!raw) throw new Error("SUTRO_SECURITY_BUNDLE_DIR is not set");
  const expanded = raw.startsWith("~/")
    ? path.join(process.env.HOME ?? "", raw.slice(2))
    : raw;
  return path.resolve(expanded);
}

function readRequired(bundleDir, name) {
  const p = path.join(bundleDir, name);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing required bundle file: ${name}`);
  }
  return fs.readFileSync(p, "utf8").trim();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function summarizeJsonShape(json) {
  if (Array.isArray(json)) {
    const first = json[0];
    return {
      topLevel: "array",
      length: json.length,
      firstItemKeys:
        first && typeof first === "object" && !Array.isArray(first)
          ? Object.keys(first)
          : [],
    };
  }
  if (json && typeof json === "object") {
    const value = json;
    return {
      topLevel: "object",
      keys: Object.keys(value),
      itemsLength: Array.isArray(value.items) ? value.items.length : undefined,
    };
  }
  if (json === null) return { topLevel: "null" };
  return { topLevel: typeof json };
}

function requestJson({ apiBase, pathName, headers, agent, timeoutMs }) {
  return new Promise((resolve) => {
    const u = new URL(pathName, `${apiBase}/`);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: "GET",
        headers,
        agent,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const bodyText = Buffer.concat(chunks).toString("utf8");
          const json = safeJsonParse(bodyText);
          resolve({
            path: pathName,
            statusCode: res.statusCode ?? 0,
            shape: json === null ? { topLevel: "non-json" } : summarizeJsonShape(json),
            preview: bodyText.slice(0, 600),
          });
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`timeout after ${timeoutMs}ms`));
    });

    req.on("error", (err) => {
      resolve({
        path: pathName,
        statusCode: 0,
        shape: { topLevel: "error" },
        preview: String(err),
      });
    });

    req.end();
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const bundleDir = resolveBundleDir();
  const apiBase = process.env.SUTRO_API_BASE?.trim() || DEFAULT_API_BASE;
  const ca = readRequired(bundleDir, "ca.crt");
  const cert = readRequired(bundleDir, "mtls.crt");
  const key = readRequired(bundleDir, "mtls.key");
  const token = readRequired(bundleDir, "builder.jwt");
  const apiClientId = readRequired(bundleDir, "apiClient.id");

  const report = {
    apiBase,
    bundleDir,
    requestedAt: new Date().toISOString(),
    timeoutMs: args.timeoutMs,
    endpoints: [],
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    "x-sutro-api-client": apiClientId,
  };

  const agent = new https.Agent({
    ca: `${tls.rootCertificates.join("\n")}\n${ca}`,
    cert,
    key,
    rejectUnauthorized: true,
  });

  const paths = [
    "/hello",
    "/projects",
    "/applications",
    `/projects/${args.projectId}/applications`,
  ];

  for (const pathName of paths) {
    const entry = await requestJson({
      apiBase,
      pathName,
      headers,
      agent,
      timeoutMs: args.timeoutMs,
    });
    report.endpoints.push(entry);
  }

  const text = JSON.stringify(report, null, 2);
  if (args.snapshotPath) {
    const snapshotPath = path.resolve(args.snapshotPath);
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.writeFileSync(snapshotPath, text, "utf8");
  }
  console.log(text);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
