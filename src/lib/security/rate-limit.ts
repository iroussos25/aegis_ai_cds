import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitBucket = {
  count: number;
  resetAt: number;
};

const inMemoryBuckets = new Map<string, LimitBucket>();
const upstashLimitersByWindow = new Map<string, Ratelimit>();

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

function getOrCreateUpstashLimiter(maxRequests: number, windowMs: number) {
  const config = getUpstashConfig();
  if (!config) return null;

  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const cacheKey = `${maxRequests}:${windowSeconds}`;
  const cached = upstashLimitersByWindow.get(cacheKey);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis: new Redis(config),
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
    analytics: true,
    prefix: "ai-clinical-context-agent",
  });

  upstashLimitersByWindow.set(cacheKey, limiter);
  return limiter;
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function enforceRateLimit(params: {
  key: string;
  maxRequests: number;
  windowMs: number;
}) {
  const upstashLimiter = getOrCreateUpstashLimiter(params.maxRequests, params.windowMs);

  if (upstashLimiter) {
    const result = await upstashLimiter.limit(params.key);

    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  }

  const now = Date.now();
  const existing = inMemoryBuckets.get(params.key);

  if (!existing || existing.resetAt <= now) {
    inMemoryBuckets.set(params.key, {
      count: 1,
      resetAt: now + params.windowMs,
    });

    return {
      allowed: true,
      remaining: params.maxRequests - 1,
      resetAt: now + params.windowMs,
    };
  }

  if (existing.count >= params.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  inMemoryBuckets.set(params.key, existing);

  return {
    allowed: true,
    remaining: params.maxRequests - existing.count,
    resetAt: existing.resetAt,
  };
}
