export type RateLimitTier = "auth" | "buildings" | "default"

type Bucket = { count: number; resetAt: number }

const WINDOW_MS = 60_000
const CLEANUP_INTERVAL_MS = 60_000

const LIMITS: Record<RateLimitTier, number> = {
  auth: 10,
  buildings: 30,
  default: 60,
}

const buckets = new Map<string, Bucket>()
let lastCleanup = 0

export function getRateLimitTier(pathname: string): RateLimitTier {
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/approve") ||
    pathname.startsWith("/api/reject")
  ) {
    return "auth"
  }
  if (pathname.startsWith("/api/buildings")) {
    return "buildings"
  }
  return "default"
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  const real = request.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number }

export function checkRateLimit(ip: string, tier: RateLimitTier): RateLimitResult {
  const now = Date.now()
  const limit = LIMITS[tier]
  const key = `${tier}:${ip}`

  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k)
    }
    lastCleanup = now
  }

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  bucket.count++
  return { allowed: true }
}
