#!/usr/bin/env node
/**
 * Local-only helper for Sutro "How to secure connections" style setup.
 * @see https://docs.withsutro.com/docs/getting-started/auth/how-to-secure-connections
 *
 * Do NOT commit real credentials. Use mcp/sutro/.env (gitignored) or:
 *   node --env-file=.env scripts/sutro-provision-from-env.mjs
 *
 * Doc curl uses JSON { "email", "password" }; some snippets use "user" — this script uses "email".
 */

import { createPrivateKey, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { SignJWT } from "jose";

const API = "https://sapi.withsutro.com";

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function optionalEnv(name) {
  return process.env[name]?.trim() || "";
}

function bundleDir() {
  const raw = optionalEnv("SUTRO_SECURITY_BUNDLE_DIR");
  if (!raw) throw new Error("Set SUTRO_SECURITY_BUNDLE_DIR to your bundle directory");
  const expanded = raw.startsWith("~/")
    ? path.join(process.env.HOME ?? "", raw.slice(2))
    : raw;
  return path.resolve(expanded);
}

function writeFile(bundle, name, content, mode = 0o600) {
  const p = path.join(bundle, name);
  fs.writeFileSync(p, content, { encoding: "utf8", mode });
  try {
    fs.chmodSync(p, mode);
  } catch {
    /* ignore */
  }
  return p;
}

async function login(email, password) {
  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST /login failed (${res.status}): ${text.slice(0, 400)}`);
  }
  const json = JSON.parse(text);
  const token = json.access_token;
  if (!token) throw new Error("No access_token in /login response");
  return token;
}

async function initialization(memberJwt, commonName, jwtIssuer) {
  const res = await fetch(`${API}/initialization`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${memberJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ commonName, jwtIssuer }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `POST /initialization failed (${res.status}): ${text.slice(0, 600)}`,
    );
  }
  return JSON.parse(text);
}

async function createBuilder(memberJwt, sid) {
  const res = await fetch(`${API}/builders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${memberJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sid }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `POST /builders failed (${res.status}): ${text.slice(0, 600)}`,
    );
  }
  return JSON.parse(text);
}

async function signBuilderJwt(bundle, jwtIssuer, builderSid) {
  const signingKeyPath = fs.existsSync(path.join(bundle, "signing.pem"))
    ? path.join(bundle, "signing.pem")
    : path.join(bundle, "mtls.key");
  if (!fs.existsSync(signingKeyPath)) {
    throw new Error(
      `Missing signing key in bundle (expected signing.pem or mtls.key)`,
    );
  }
  const pem = fs.readFileSync(signingKeyPath, "utf8");
  const key = createPrivateKey(pem);

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(jwtIssuer)
    .setSubject(builderSid)
    .setAudience(API)
    .setJti(randomUUID())
    .setExpirationTime("1h")
    .sign(key);

  writeFile(bundle, "builder.jwt", jwt, 0o600);
  return jwt;
}

function readText(bundle, name) {
  const p = path.join(bundle, name);
  if (!fs.existsSync(p)) return "";
  return fs.readFileSync(p, "utf8").trim();
}

async function main() {
  const mode = (optionalEnv("SUTRO_PROVISION_MODE") || "sign-only").toLowerCase();
  const bundle = bundleDir();

  if (mode === "sign-only") {
    const jwtIssuer =
      optionalEnv("SUTRO_JWT_ISSUER") || readText(bundle, "jwtIssuer.id");
    const builderSid =
      optionalEnv("SUTRO_BUILDER_SID") ||
      readText(bundle, ".sutro-builder-sid") ||
      readText(bundle, "builder.id");
    if (!jwtIssuer) {
      throw new Error(
        "sign-only: set SUTRO_JWT_ISSUER or put jwtIssuer.id in the bundle directory",
      );
    }
    if (!builderSid) {
      throw new Error(
        "sign-only: set SUTRO_BUILDER_SID or create .sutro-builder-sid in the bundle (see full mode)",
      );
    }
    await signBuilderJwt(bundle, jwtIssuer, builderSid);
    console.error(
      `Wrote ${path.join(bundle, "builder.jwt")} (1h). Re-run sutro_hello in Cursor.`,
    );
    return;
  }

  if (mode !== "full") {
    throw new Error(
      `Unknown SUTRO_PROVISION_MODE="${mode}". Use "sign-only" or "full".`,
    );
  }

  const email = requireEnv("SUTRO_ORG_EMAIL");
  const password = requireEnv("SUTRO_ORG_PASSWORD");
  const commonName = requireEnv("SUTRO_COMMON_NAME");
  const jwtIssuer = requireEnv("SUTRO_JWT_ISSUER");

  const memberJwt = await login(email, password);
  const init = await initialization(memberJwt, commonName, jwtIssuer);

  const privateKey = init.privateKey;
  const certContent = init.certificate?.content;
  const apiClientId = init.apiClientIdentifier;
  if (!privateKey || !certContent || !apiClientId) {
    throw new Error(
      "Unexpected /initialization response shape (missing privateKey, certificate.content, or apiClientIdentifier)",
    );
  }

  writeFile(bundle, "mtls.key", privateKey, 0o600);
  writeFile(bundle, "mtls.crt", certContent, 0o644);
  writeFile(bundle, "apiClient.id", apiClientId, 0o644);
  writeFile(bundle, "jwtIssuer.id", jwtIssuer, 0o644);

  const builderSid = randomUUID();
  await createBuilder(memberJwt, builderSid);
  writeFile(bundle, ".sutro-builder-sid", builderSid, 0o600);

  await signBuilderJwt(bundle, jwtIssuer, builderSid);

  console.error("Wrote mtls.key, mtls.crt, apiClient.id, jwtIssuer.id, .sutro-builder-sid, builder.jwt");
  console.error(
    "If /initialization failed, your org may already be initialized — use sign-only with your existing key and issuer/sub.",
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
