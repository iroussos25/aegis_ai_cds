import { PDFParse } from "pdf-parse";
import { validateServerEnv } from "@/lib/env";
import { writeAuditLog } from "@/lib/security/audit";
import { runSecurityGuard } from "@/lib/security/guard";
import { createJsonError, createJsonOk, getRequestId } from "@/lib/security/response";

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
  const requestId = getRequestId();
  const startedAt = Date.now();

  try {
    validateServerEnv("core");
  } catch (error) {
    return createJsonError(
      req,
      500,
      error instanceof Error ? error.message : "Environment validation failed",
      requestId
    );
  }

  const guard = await runSecurityGuard(req, requestId, {
    routeKey: "upload",
    maxRequests: 12,
    windowMs: 60_000,
  });

  if (!guard.ok) {
    await writeAuditLog({
      route: "/api/upload",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: guard.response.status,
      durationMs: Date.now() - startedAt,
      error: "security_guard_rejected",
    });
    return guard.response;
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    await writeAuditLog({
      route: "/api/upload",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: 400,
      durationMs: Date.now() - startedAt,
      error: "No file provided",
    });
    return createJsonError(req, 400, "No file provided", requestId);
  }

  if (file.size > MAX_FILE_SIZE) {
    await writeAuditLog({
      route: "/api/upload",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: 400,
      durationMs: Date.now() - startedAt,
      error: "File exceeds size limit",
    });
    return createJsonError(req, 400, "File exceeds 10 MB limit", requestId);
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
      await writeAuditLog({
        route: "/api/upload",
        method: "POST",
        requestId,
        ip: guard.ip,
        status: 400,
        durationMs: Date.now() - startedAt,
        error: `Unsupported file type: ${ext}`,
      });
      return createJsonError(
        req,
        400,
        `Unsupported file type: .${ext}. Accepted: .pdf, .txt, .csv, .md, .xml, .json, .tsv, .hl7`,
        requestId
      );
    }

    // Sanitize: strip null bytes, control chars (keep newlines/tabs), and excessive whitespace
    text = text
      .replace(/\0/g, "")
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();

    if (!text) {
      await writeAuditLog({
        route: "/api/upload",
        method: "POST",
        requestId,
        ip: guard.ip,
        status: 400,
        durationMs: Date.now() - startedAt,
        error: "Parsed text was empty",
      });
      return createJsonError(req, 400, "File appears to be empty or could not be read", requestId);
    }

    const response = createJsonOk(req, { text }, requestId);
    await writeAuditLog({
      route: "/api/upload",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse file";
    await writeAuditLog({
      route: "/api/upload",
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
