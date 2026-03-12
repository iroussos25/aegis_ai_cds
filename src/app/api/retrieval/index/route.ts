import { NextResponse } from "next/server";

import { chunkText } from "@/lib/chunking";
import { embedText } from "@/lib/embeddings";
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
  try {
    const body = await req.json();
    const context = typeof body.context === "string" ? body.context.trim() : "";
    const fileName = typeof body.fileName === "string" ? body.fileName : null;
    const sourceType =
      typeof body.sourceType === "string" && body.sourceType.trim()
        ? body.sourceType
        : "manual";

    if (!context) {
      return NextResponse.json({ error: "Context is required" }, { status: 400 });
    }

    const chunks = chunkText(context, 1200, 220);
    if (chunks.length === 0) {
      return NextResponse.json({ error: "No chunks were produced" }, { status: 400 });
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
      return NextResponse.json(
        {
          error:
            "Failed to index chunks in Supabase. Ensure table document_chunks exists with vector support.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      docId,
      chunkCount: rows.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Indexing failed",
      },
      { status: 500 }
    );
  }
}
