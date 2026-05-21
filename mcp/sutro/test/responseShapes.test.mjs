import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeArrayFirstListResponse,
  normalizeObjectResponse,
  normalizeOpenApiResponse,
} from "../dist/responseShapes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures");

function readFixture(name) {
  const full = path.join(fixtures, name);
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

test("normalizeArrayFirstListResponse accepts observed plain array shape", () => {
  const projects = readFixture("projects.array.json");
  const out = normalizeArrayFirstListResponse(projects, "GET /projects");
  assert.equal(out.source, "array");
  assert.equal(out.items.length, 3);
});

test("normalizeArrayFirstListResponse accepts wrapped compatibility shape", () => {
  const wrapped = readFixture("list.wrapped.json");
  const out = normalizeArrayFirstListResponse(wrapped, "GET /legacy");
  assert.equal(out.source, "wrapped");
  assert.equal(out.items.length, 2);
  assert.deepEqual(out.metadata, { nextPageToken: "abc123" });
});

test("normalizeArrayFirstListResponse rejects malformed list payloads", () => {
  assert.throws(
    () => normalizeArrayFirstListResponse({ projects: [] }, "GET /projects"),
    /unexpected list shape/,
  );
});

test("normalizeObjectResponse accepts object payloads", () => {
  const app = readFixture("applications.array.json")[0];
  const out = normalizeObjectResponse(app, "GET /applications/:id");
  assert.equal(out.id, "8cbebb4f-6b10-43c0-bcc9-6004e52d2d93");
});

test("normalizeObjectResponse rejects arrays", () => {
  const apps = readFixture("applications.array.json");
  assert.throws(
    () => normalizeObjectResponse(apps, "GET /applications/:id"),
    /unexpected object shape/,
  );
});

test("normalizeOpenApiResponse prefers JSON when present", () => {
  const spec = { openapi: "3.0.0" };
  assert.deepEqual(normalizeOpenApiResponse(spec, ""), spec);
});

test("normalizeOpenApiResponse falls back to text body", () => {
  const text = "{\"openapi\":\"3.0.0\"}";
  assert.equal(normalizeOpenApiResponse(null, text), text);
});

test("normalizeOpenApiResponse rejects empty body", () => {
  assert.throws(() => normalizeOpenApiResponse(null, "   "), /empty response body/);
});
