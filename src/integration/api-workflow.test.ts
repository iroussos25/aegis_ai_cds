import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/google-text", () => ({
  generateGoogleText: vi.fn(async () => ({
    text: "Mock clinical response",
    model: "gemini-2.5-flash",
  })),
}));

vi.mock("@/lib/embeddings", () => ({
  embedText: vi.fn(async () => Array.from({ length: 768 }, (_, index) => index / 1000)),
}));

vi.mock("@/lib/pubmed", () => ({
  searchPubMedLiterature: vi.fn(async () => ({
    query: "mock-query",
    evidence: [
      {
        id: "123",
        title: "Mock paper",
        abstractSnippet: "Abstract summary",
        sourceLabel: "PubMed",
        sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/123/",
      },
    ],
  })),
}));

vi.mock("@/lib/supabase-server", () => {
  const mockRows: Array<Record<string, unknown>> = [];

  return {
    getSupabaseServerClient: vi.fn(() => ({
      from: vi.fn(() => ({
        insert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
          mockRows.splice(0, mockRows.length, ...rows);
          return { error: null };
        }),
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      })),
      rpc: vi.fn(async () => ({
        data: [
          {
            id: "row-1",
            chunk_index: 0,
            content: "Mock chunk",
            similarity: 0.98,
            metadata: { fileName: "sample.txt" },
          },
        ],
        error: null,
      })),
    })),
  };
});

describe("API workflow smoke test", () => {
  it("handles upload -> analyze -> retrieval -> review flow", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

    const { POST: uploadPost } = await import("@/app/api/upload/route");
    const { POST: analyzePost } = await import("@/app/api/analyze/route");
    const { POST: retrievalIndexPost } = await import("@/app/api/retrieval/index/route");
    const { POST: retrievalQueryPost } = await import("@/app/api/retrieval/query/route");
    const { POST: reviewPost } = await import("@/app/api/clinical-review/route");

    const uploadForm = new FormData();
    uploadForm.append("file", new File(["clinical note content"], "sample.txt", { type: "text/plain" }));
    const uploadReq = new Request("http://localhost/api/upload", { method: "POST", body: uploadForm });
    const uploadRes = await uploadPost(uploadReq);
    expect(uploadRes.status).toBe(200);

    const analyzeReq = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Summarize",
        context: "Patient presents with hypotension and elevated lactate",
      }),
    });
    const analyzeRes = await analyzePost(analyzeReq);
    expect(analyzeRes.status).toBe(200);

    const indexReq = new Request("http://localhost/api/retrieval/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "Patient presents with hypotension and elevated lactate",
        fileName: "sample.txt",
        sourceType: "upload",
      }),
    });
    const indexRes = await retrievalIndexPost(indexReq);
    expect(indexRes.status).toBe(200);

    const queryReq = new Request("http://localhost/api/retrieval/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "lactate", topK: 3 }),
    });
    const queryRes = await retrievalQueryPost(queryReq);
    expect(queryRes.status).toBe(200);

    const reviewReq = new Request("http://localhost/api/clinical-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteContext: "Patient presents with hypotension and elevated lactate",
        externalEvidence: [],
        messages: [{ role: "user", content: "What are key concerns?" }],
      }),
    });
    const reviewRes = await reviewPost(reviewReq);
    expect(reviewRes.status).toBe(200);
  });
});
