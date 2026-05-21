export type NormalizedListResponse = {
  items: unknown[];
  metadata?: unknown;
  source: "array" | "wrapped";
};

export function normalizeArrayFirstListResponse(
  json: unknown,
  endpointLabel: string,
): NormalizedListResponse {
  if (Array.isArray(json)) {
    return { items: json, source: "array" };
  }
  if (json && typeof json === "object") {
    const wrapped = json as { items?: unknown[]; metadata?: unknown };
    if (Array.isArray(wrapped.items)) {
      return {
        items: wrapped.items,
        metadata: wrapped.metadata,
        source: "wrapped",
      };
    }
  }
  throw new Error(
    `${endpointLabel} returned unexpected list shape (expected array or { items: [] })`,
  );
}

export function normalizeObjectResponse(
  json: unknown,
  endpointLabel: string,
): Record<string, unknown> {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    return json as Record<string, unknown>;
  }
  throw new Error(
    `${endpointLabel} returned unexpected object shape (expected JSON object)`,
  );
}

export function normalizeOpenApiResponse(
  json: unknown,
  bodyText: string,
): unknown {
  if (json !== null) return json;
  if (bodyText.trim().length > 0) return bodyText;
  throw new Error("OpenAPI endpoint returned empty response body");
}
