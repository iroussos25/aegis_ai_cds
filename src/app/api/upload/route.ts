import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

const TEXT_EXTENSIONS = new Set([
  "txt",
  "csv",
  "md",
  "xml",
  "json",
  "tsv",
  "hl7",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File exceeds 10 MB limit" },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  try {
    let text: string;

    if (ext === "pdf") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      text = result.text;
      await parser.destroy();
    } else if (TEXT_EXTENSIONS.has(ext)) {
      text = await file.text();
    } else {
      return NextResponse.json(
        {
          error: `Unsupported file type: .${ext}. Accepted: .pdf, .txt, .csv, .md, .xml, .json, .tsv, .hl7`,
        },
        { status: 400 }
      );
    }

    // Sanitize: strip null bytes, control chars (keep newlines/tabs), and excessive whitespace
    text = text
      .replace(/\0/g, "")
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();

    if (!text) {
      return NextResponse.json(
        { error: "File appears to be empty or could not be read" },
        { status: 400 }
      );
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse file" },
      { status: 500 }
    );
  }
}
