import { embedText } from "@/lib/embeddings";
import { validateServerEnv } from "@/lib/env";
import { writeAuditLog } from "@/lib/security/audit";
import { runSecurityGuard } from "@/lib/security/guard";
import { parseAndValidateJson } from "@/lib/security/parse";
import { createJsonError, createJsonOk, getRequestId } from "@/lib/security/response";
import { RetrievalQueryRequestSchema } from "@/lib/security/schemas";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type QueryResult = {
  id: string;
  chunk_index: number;
  content: string;
  similarity: number;
  metadata?: { fileName?: string };
};

type FallbackRow = {
  id: string;
  chunk_index: number;
  content: string;
  embedding_json: number[] | null;
  metadata?: { fileName?: string };
};

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) return -1;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? -1 : dot / denom;
}

function toVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

export async function POST(req: Request) {
  const requestId = getRequestId();
  const startedAt = Date.now();

  try {
    validateServerEnv("retrieval");
  } catch (error) {
    return createJsonError(
      req,
      500,
      error instanceof Error ? error.message : "Environment validation failed",
      requestId
    );
  }

  const guard = await runSecurityGuard(req, requestId, {
    routeKey: "retrieval-query",
    maxRequests: 60,
    windowMs: 60_000,
  });

  if (!guard.ok) {
    await writeAuditLog({
      route: "/api/retrieval/query",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: guard.response.status,
      durationMs: Date.now() - startedAt,
      error: "security_guard_rejected",
    });
    return guard.response;
  }

  try {
    const parsed = await parseAndValidateJson(req, RetrievalQueryRequestSchema);
    if (!parsed.ok) {
      await writeAuditLog({
        route: "/api/retrieval/query",
        method: "POST",
        requestId,
        ip: guard.ip,
        status: 400,
        durationMs: Date.now() - startedAt,
        error: parsed.message,
      });
      return createJsonError(req, 400, parsed.message, requestId);
    }

    const query = parsed.data.query;
    const docId = parsed.data.docId ?? null;
    const topK = parsed.data.topK ?? 6;

    const queryEmbedding = await embedText(query);
    const supabase = getSupabaseServerClient();

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "match_document_chunks",
      {
        query_embedding: toVectorLiteral(queryEmbedding),
        match_count: topK,
        filter: docId ? { doc_id: docId } : {},
      }
    );

    if (!rpcError && Array.isArray(rpcData)) {
      const response = createJsonOk(req, {
        evidence: (rpcData as QueryResult[]).map((row) => ({
          id: row.id,
          chunkIndex: row.chunk_index,
          content: row.content,
          similarity: row.similarity,
          sourceLabel: row.metadata?.fileName ?? "Clinical context",
        })),
      }, requestId);

      await writeAuditLog({
        route: "/api/retrieval/query",
        method: "POST",
        requestId,
        ip: guard.ip,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response;
    }

    let selectBuilder = supabase
      .from("document_chunks")
      .select("id, chunk_index, content, embedding_json, metadata")
      .limit(250);

    if (docId) {
      selectBuilder = selectBuilder.eq("doc_id", docId);
    }

    const { data: fallbackData, error: fallbackError } = await selectBuilder;

    if (fallbackError || !fallbackData) {
      return createJsonError(
        req,
        500,
        `Retrieval failed. ${fallbackError?.message ?? rpcError?.message ?? "Unknown error"}`,
        requestId
      );
    }

    const ranked = (fallbackData as FallbackRow[])
      .filter((row) => Array.isArray(row.embedding_json))
      .map((row) => ({
        id: row.id,
        chunkIndex: row.chunk_index,
        content: row.content,
        similarity: cosineSimilarity(queryEmbedding, row.embedding_json as number[]),
        sourceLabel: row.metadata?.fileName ?? "Clinical context",
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    const response = createJsonOk(req, { evidence: ranked }, requestId);
    await writeAuditLog({
      route: "/api/retrieval/query",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retrieval query failed";
    await writeAuditLog({
      route: "/api/retrieval/query",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: 500,
      durationMs: Date.now() - startedAt,
      error: message,
    });
    return createJsonError(req, 500, message, requestId);
  }
}
