import { NextResponse } from "next/server";

import { embedText } from "@/lib/embeddings";
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
  try {
    const body = await req.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const docId = typeof body.docId === "string" ? body.docId : null;
    const topK =
      typeof body.topK === "number" && body.topK > 0 && body.topK <= 12
        ? body.topK
        : 6;

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

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
      return NextResponse.json({
        evidence: (rpcData as QueryResult[]).map((row) => ({
          id: row.id,
          chunkIndex: row.chunk_index,
          content: row.content,
          similarity: row.similarity,
          sourceLabel: row.metadata?.fileName ?? "Clinical context",
        })),
      });
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
      return NextResponse.json(
        {
          error: "Retrieval failed.",
          details: fallbackError?.message ?? rpcError?.message,
        },
        { status: 500 }
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

    return NextResponse.json({ evidence: ranked });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Retrieval query failed",
      },
      { status: 500 }
    );
  }
}
