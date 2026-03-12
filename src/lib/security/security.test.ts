import { describe, expect, it } from "vitest";

import { validateApiKey } from "@/lib/security/auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  AnalyzeRequestSchema,
  ClinicalReviewRequestSchema,
  RetrievalQueryRequestSchema,
} from "@/lib/security/schemas";

describe("security schemas", () => {
  it("accepts a valid analyze payload", () => {
    const parsed = AnalyzeRequestSchema.safeParse({
      prompt: "Summarize key findings",
      context: "Patient with elevated lactate and hypotension requiring vasopressor support.",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid clinical review payloads", () => {
    const parsed = ClinicalReviewRequestSchema.safeParse({
      noteContext: "short",
      externalEvidence: [],
      messages: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("applies retrieval topK boundaries", () => {
    const parsed = RetrievalQueryRequestSchema.safeParse({
      query: "AKI",
      topK: 30,
    });

    expect(parsed.success).toBe(false);
  });
});

describe("auth guard", () => {
  it("bypasses auth when APP_API_KEY is not configured", () => {
    delete process.env.APP_API_KEY;

    const request = new Request("http://localhost/api/analyze", {
      method: "POST",
    });

    const result = validateApiKey(request);
    expect(result.ok).toBe(true);
    expect(result.bypassed).toBe(true);
  });

  it("rejects missing key when APP_API_KEY is configured", () => {
    process.env.APP_API_KEY = "expected-secret";

    const request = new Request("http://localhost/api/analyze", {
      method: "POST",
    });

    const result = validateApiKey(request);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("invalid API key");

    delete process.env.APP_API_KEY;
  });
});

describe("rate limiting fallback", () => {
  it("blocks requests after maxRequests in in-memory mode", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const key = `test-rate-limit-${Date.now()}`;

    const first = await enforceRateLimit({
      key,
      maxRequests: 2,
      windowMs: 60_000,
    });

    const second = await enforceRateLimit({
      key,
      maxRequests: 2,
      windowMs: 60_000,
    });

    const third = await enforceRateLimit({
      key,
      maxRequests: 2,
      windowMs: 60_000,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });
});
