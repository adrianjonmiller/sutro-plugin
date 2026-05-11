import fs from "node:fs";
import { createPrivateKey, createSign, randomUUID } from "node:crypto";
import https from "node:https";
import path from "node:path";
import tls from "node:tls";

const DEFAULT_API_BASE = "https://sapi.withsutro.com";

function expandBundleDir(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("~/")) {
    return path.join(process.env.HOME ?? "", trimmed.slice(2));
  }
  return trimmed;
}

export function resolveBundleDir(): string | null {
  const dir = process.env.SUTRO_SECURITY_BUNDLE_DIR;
  if (!dir?.trim()) return null;
  return path.resolve(expandBundleDir(dir));
}

export function resolveApiBase(): string {
  const base = process.env.SUTRO_API_BASE?.trim() || DEFAULT_API_BASE;
  return base.replace(/\/$/, "");
}

function readBundleFile(bundleDir: string, name: string): string {
  const full = path.join(bundleDir, name);
  if (!fs.existsSync(full)) {
    throw new Error(
      `Missing bundle file "${name}" under SUTRO_SECURITY_BUNDLE_DIR`,
    );
  }
  return fs.readFileSync(full, "utf8").trim();
}

function tryReadBundleFile(bundleDir: string, name: string): string | null {
  const full = path.join(bundleDir, name);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8").trim();
}

function writeBundleFile(bundleDir: string, name: string, content: string): void {
  const full = path.join(bundleDir, name);
  fs.writeFileSync(full, content, { encoding: "utf8", mode: 0o600 });
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1]!, "base64url").toString("utf8");
    return JSON.parse(payload) as { exp?: number };
  } catch {
    return null;
  }
}

function isJwtFreshEnough(token: string, skewSeconds = 60): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp > now + skewSeconds;
}

function base64UrlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

function signJwtRs256(payload: Record<string, unknown>, signingPem: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const tokenBase = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createSign("RSA-SHA256")
    .update(tokenBase)
    .end()
    .sign(createPrivateKey(signingPem))
    .toString("base64url");
  return `${tokenBase}.${signature}`;
}

function resolveBuilderSub(bundleDir: string): string {
  return (
    process.env.SUTRO_BUILDER_SID?.trim() ||
    tryReadBundleFile(bundleDir, ".sutro-builder-sid") ||
    tryReadBundleFile(bundleDir, "builder.id") ||
    ""
  );
}

function refreshBuilderJwt(bundleDir: string, apiBase: string): string {
  const signingPem =
    tryReadBundleFile(bundleDir, "signing.pem") || readBundleFile(bundleDir, "mtls.key");
  const issuer = tryReadBundleFile(bundleDir, "jwtIssuer.id");
  const sub = resolveBuilderSub(bundleDir);
  if (!issuer) {
    throw new Error(
      'Cannot refresh builder.jwt: missing "jwtIssuer.id" in security bundle',
    );
  }
  if (!sub) {
    throw new Error(
      'Cannot refresh builder.jwt: missing builder subject (set SUTRO_BUILDER_SID or add ".sutro-builder-sid"/"builder.id" in bundle)',
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const token = signJwtRs256(
    {
      iss: issuer,
      sub,
      aud: apiBase,
      jti: randomUUID(),
      exp: now + 3600,
    },
    signingPem,
  );
  writeBundleFile(bundleDir, "builder.jwt", token);
  return token;
}

export type SutroCredentials = {
  ca: string;
  cert: string;
  key: string;
  bearerToken: string;
  apiClientId: string;
};

export function loadCredentials(bundleDir: string): SutroCredentials {
  const apiBase = resolveApiBase();
  const existing = tryReadBundleFile(bundleDir, "builder.jwt");
  const bearerToken =
    existing && isJwtFreshEnough(existing)
      ? existing
      : refreshBuilderJwt(bundleDir, apiBase);
  return {
    ca: readBundleFile(bundleDir, "ca.crt"),
    cert: readBundleFile(bundleDir, "mtls.crt"),
    key: readBundleFile(bundleDir, "mtls.key"),
    bearerToken,
    apiClientId: readBundleFile(bundleDir, "apiClient.id"),
  };
}

export type SutroRequestOptions = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
};

export type SutroRequestResult = {
  statusCode: number;
  bodyText: string;
};

function buildUrl(apiBase: string, requestPath: string): URL {
  const p = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
  return new URL(p, `${apiBase}/`);
}

function trustStoreWithBundleCa(bundleCa: string): string {
  const roots = tls.rootCertificates.join("\n");
  return `${roots}\n${bundleCa}`;
}

export function sutroRequest(
  creds: SutroCredentials,
  apiBase: string,
  options: SutroRequestOptions,
): Promise<SutroRequestResult> {
  const url = buildUrl(apiBase, options.path);
  const agent = new https.Agent({
    ca: trustStoreWithBundleCa(creds.ca),
    cert: creds.cert,
    key: creds.key,
    rejectUnauthorized: true,
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.bearerToken}`,
    "x-sutro-api-client": creds.apiClientId,
  };

  let bodyStr: string | undefined;
  if (options.body !== undefined) {
    bodyStr = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(Buffer.byteLength(bodyStr, "utf8"));
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: options.method,
        headers,
        agent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const bodyText = Buffer.concat(chunks).toString("utf8");
          resolve({
            statusCode: res.statusCode ?? 0,
            bodyText,
          });
        });
      },
    );

    req.on("error", (err: Error) => {
      reject(
        new Error(`Sutro request failed: ${redactForErrorMessage(err.message)}`),
      );
    });

    if (bodyStr !== undefined) req.write(bodyStr);
    req.end();
  });
}

export type SutroCallResult = {
  statusCode: number;
  bodyText: string;
  json: unknown;
};

export async function callSutro(
  options: SutroRequestOptions,
): Promise<SutroCallResult> {
  const bundleDir = resolveBundleDir();
  if (!bundleDir) {
    throw new Error("SUTRO_SECURITY_BUNDLE_DIR is not set");
  }
  const creds = loadCredentials(bundleDir);
  const apiBase = resolveApiBase();
  let result = await sutroRequest(creds, apiBase, options);
  // If the token expired mid-session, refresh from the bundle and retry once.
  if (
    result.statusCode === 401 &&
    /JWT Token Expired/i.test(result.bodyText)
  ) {
    const freshToken = refreshBuilderJwt(bundleDir, apiBase);
    result = await sutroRequest({ ...creds, bearerToken: freshToken }, apiBase, options);
  }
  let json: unknown = null;
  try {
    json = JSON.parse(result.bodyText) as unknown;
  } catch {
    // bodyText is not JSON — leave json as null
  }
  return { ...result, json };
}

/** Exposed for tests; avoid logging in production paths. */
export function redactForErrorMessage(message: string): string {
  let out = message;
  const jwtPattern = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
  out = out.replace(jwtPattern, "[jwt]");
  out = out.replace(
    /-----BEGIN[^-]+-----[\s\S]*?-----END[^-]+-----/g,
    "[pem]",
  );
  return out;
}
