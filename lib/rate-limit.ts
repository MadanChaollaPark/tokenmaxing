import type { NextRequest } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  tokenmaxingRateLimit?: Map<string, Bucket>;
};

const buckets = (globalForRateLimit.tokenmaxingRateLimit ||= new Map<string, Bucket>());

export function checkRateLimit(
  request: NextRequest,
  scope: string,
  options: { limit: number; windowMs: number }
) {
  const now = Date.now();
  const key = `${scope}:${clientKey(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true, remaining: options.limit - 1, retryAfter: 0 };
  }

  if (current.count >= options.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((current.resetAt - now) / 1000)
    };
  }

  current.count += 1;
  return {
    ok: true,
    remaining: options.limit - current.count,
    retryAfter: 0
  };
}

function clientKey(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "local"
  );
}
