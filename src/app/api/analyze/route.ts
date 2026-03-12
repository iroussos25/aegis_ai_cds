import { generateGoogleText } from "@/lib/google-text";
import { validateServerEnv } from "@/lib/env";
import { writeAuditLog } from "@/lib/security/audit";
import { runSecurityGuard } from "@/lib/security/guard";
import { parseAndValidateJson } from "@/lib/security/parse";
import { createJsonError, createTextResponse, getRequestId } from "@/lib/security/response";
import { AnalyzeRequestSchema } from "@/lib/security/schemas";

const SYSTEM_PROMPT = `You are a Clinical Data Integrity Specialist. Your sole responsibility is to analyze and answer questions based strictly on the clinical document context provided below.

Rules you must follow:
1. ONLY use information explicitly stated in the provided context. Do not use any prior medical knowledge or training data to supplement your answers.
2. If the answer cannot be found in the context, respond with: "The provided clinical document does not contain sufficient information to answer this question."
3. When referencing data from the context, be precise — cite specific values, dates, findings, or terminology exactly as they appear.
4. Do not speculate, infer beyond what is written, or provide differential diagnoses unless they are explicitly mentioned in the context.
5. Maintain a professional, concise tone appropriate for clinical data review.
6. If the context contains ambiguous or potentially conflicting information, flag it explicitly rather than choosing one interpretation silently.`;

export async function POST(req: Request) {
  const requestId = getRequestId();
  const startedAt = Date.now();

  try {
    validateServerEnv("ai");
  } catch (error) {
    return createJsonError(
      req,
      500,
      error instanceof Error ? error.message : "Environment validation failed",
      requestId
    );
  }

  const guard = await runSecurityGuard(req, requestId, {
    routeKey: "analyze",
    maxRequests: 50,
    windowMs: 60_000,
  });

  if (!guard.ok) {
    await writeAuditLog({
      route: "/api/analyze",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: guard.response.status,
      durationMs: Date.now() - startedAt,
      error: "security_guard_rejected",
    });
    return guard.response;
  }

  const parsed = await parseAndValidateJson(req, AnalyzeRequestSchema);
  if (!parsed.ok) {
    await writeAuditLog({
      route: "/api/analyze",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: 400,
      durationMs: Date.now() - startedAt,
      error: parsed.message,
    });
    return createJsonError(req, 400, parsed.message, requestId);
  }

  const { prompt, context } = parsed.data;

  // Sanitize inputs: strip null bytes and dangerous control characters
  const cleanPrompt = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  const cleanContext = context.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();

  try {
    const result = await generateGoogleText({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `<clinical_document_context>\n${cleanContext}\n</clinical_document_context>\n\nQuestion: ${cleanPrompt}`,
        },
      ],
    });

    const response = createTextResponse(req, 200, result.text, requestId, {
      "X-Model-Used": result.model,
    });

    await writeAuditLog({
      route: "/api/analyze",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: response.status,
      durationMs: Date.now() - startedAt,
      modelUsed: result.model,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clinical analysis failed";
    await writeAuditLog({
      route: "/api/analyze",
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
