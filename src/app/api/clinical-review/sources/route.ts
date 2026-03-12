import { searchPubMedLiterature } from "@/lib/pubmed";
import { validateServerEnv } from "@/lib/env";
import { writeAuditLog } from "@/lib/security/audit";
import { runSecurityGuard } from "@/lib/security/guard";
import { parseAndValidateJson } from "@/lib/security/parse";
import { createJsonError, createJsonOk, getRequestId } from "@/lib/security/response";
import { ClinicalReviewSourceRequestSchema } from "@/lib/security/schemas";

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
    routeKey: "clinical-review-sources",
    maxRequests: 20,
    windowMs: 60_000,
  });

  if (!guard.ok) {
    await writeAuditLog({
      route: "/api/clinical-review/sources",
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
    const parsed = await parseAndValidateJson(req, ClinicalReviewSourceRequestSchema);
    if (!parsed.ok) {
      await writeAuditLog({
        route: "/api/clinical-review/sources",
        method: "POST",
        requestId,
        ip: guard.ip,
        status: 400,
        durationMs: Date.now() - startedAt,
        error: parsed.message,
      });
      return createJsonError(req, 400, parsed.message, requestId);
    }

    const prompt = parsed.data.prompt;
    const context = parsed.data.context;

    const result = await searchPubMedLiterature(prompt, context);

    const response = createJsonOk(req, result, requestId);
    await writeAuditLog({
      route: "/api/clinical-review/sources",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Literature search failed";
    await writeAuditLog({
      route: "/api/clinical-review/sources",
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
