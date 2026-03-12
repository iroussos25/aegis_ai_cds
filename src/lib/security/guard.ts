import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { validateApiKey } from "@/lib/security/auth";
import { createJsonError } from "@/lib/security/response";

type GuardOptions = {
  routeKey: string;
  maxRequests: number;
  windowMs: number;
};

export async function runSecurityGuard(request: Request, requestId: string, options: GuardOptions) {
  const ip = getClientIp(request);
  const auth = validateApiKey(request);

  if (!auth.ok) {
    return {
      ok: false as const,
      ip,
      response: createJsonError(request, 401, auth.reason, requestId),
    };
  }

  const limit = await enforceRateLimit({
    key: `${options.routeKey}:${ip}`,
    maxRequests: options.maxRequests,
    windowMs: options.windowMs,
  });

  if (!limit.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    const response = createJsonError(request, 429, "Rate limit exceeded. Please retry later.", requestId);
    response.headers.set("Retry-After", retryAfterSeconds.toString());
    return {
      ok: false as const,
      ip,
      response,
    };
  }

  return {
    ok: true as const,
    ip,
  };
}
