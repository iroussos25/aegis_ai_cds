import { chunkText } from "@/lib/chunking";
import { embedText } from "@/lib/embeddings";
import { validateServerEnv } from "@/lib/env";
import { writeAuditLog } from "@/lib/security/audit";
import { runSecurityGuard } from "@/lib/security/guard";
import { parseAndValidateJson } from "@/lib/security/parse";
import { createJsonError, createJsonOk, getRequestId } from "@/lib/security/response";
import { RetrievalIndexRequestSchema } from "@/lib/security/schemas";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type InsertRow = {
  doc_id: string;
  chunk_index: number;
  content: string;
  embedding: string;
  embedding_json: number[];
  metadata: {
    fileName: string | null;
    sourceType: string;
  };
};

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
    routeKey: "retrieval-index",
    maxRequests: 20,
    windowMs: 60_000,
  });

  if (!guard.ok) {
    await writeAuditLog({
      route: "/api/retrieval/index",
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
    const parsed = await parseAndValidateJson(req, RetrievalIndexRequestSchema);
    if (!parsed.ok) {
      await writeAuditLog({
        route: "/api/retrieval/index",
        method: "POST",
        requestId,
        ip: guard.ip,
        status: 400,
        durationMs: Date.now() - startedAt,
        error: parsed.message,
      });
      return createJsonError(req, 400, parsed.message, requestId);
    }

    const context = parsed.data.context;
    const fileName = parsed.data.fileName ?? null;
    const sourceType = parsed.data.sourceType ?? "manual";

    const chunks = chunkText(context, 1200, 220);
    if (chunks.length === 0) {
      return createJsonError(req, 400, "No chunks were produced", requestId);
    }

    const docId = crypto.randomUUID();

    const rows: InsertRow[] = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const content = chunks[i];
      const embedding = await embedText(content);

      rows.push({
        doc_id: docId,
        chunk_index: i,
        content,
        embedding: toVectorLiteral(embedding),
        embedding_json: embedding,
        metadata: {
          fileName,
          sourceType,
        },
      });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("document_chunks").insert(rows);

    if (error) {
      return createJsonError(
        req,
        500,
        `Failed to index chunks in Supabase. ${error.message}`,
        requestId
      );
    }

    const response = createJsonOk(req, {
      docId,
      chunkCount: rows.length,
    }, requestId);

    await writeAuditLog({
      route: "/api/retrieval/index",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Indexing failed";
    await writeAuditLog({
      route: "/api/retrieval/index",
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
