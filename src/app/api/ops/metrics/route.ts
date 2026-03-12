import { runSecurityGuard } from "@/lib/security/guard";
import { createJsonError, createJsonOk, getRequestId } from "@/lib/security/response";
import { getMetricsSnapshot } from "@/lib/observability/metrics";
import { validateServerEnv } from "@/lib/env";

export async function POST(req: Request) {
  const requestId = getRequestId();

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
    routeKey: "ops-metrics",
    maxRequests: 10,
    windowMs: 60_000,
  });

  if (!guard.ok) {
    return guard.response;
  }

  return createJsonOk(req, getMetricsSnapshot(), requestId);
}
