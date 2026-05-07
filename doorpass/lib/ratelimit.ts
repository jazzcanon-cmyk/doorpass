import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

/**
 * Upstash 환경변수가 미설정이면 limiter는 null이 되고 모든 요청이 통과한다(fail-open).
 * Redis 호출 자체가 throw하는 경우에도 fail-open으로 처리한다 — 가용성 우선.
 */
const _redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

export const generalLimiter: Ratelimit | null = _redis
  ? new Ratelimit({
      redis: _redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      analytics: true,
      prefix: "ratelimit:general",
    })
  : null

export const passwordLimiter: Ratelimit | null = _redis
  ? new Ratelimit({
      redis: _redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      analytics: true,
      prefix: "ratelimit:password",
    })
  : null

export const authLimiter: Ratelimit | null = _redis
  ? new Ratelimit({
      redis: _redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: true,
      prefix: "ratelimit:auth",
    })
  : null

export type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  if (!limiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }
  try {
    return await limiter.limit(identifier)
  } catch (e) {
    console.error("[ratelimit] failed, failing open:", (e as Error).message)
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }
}

/**
 * 식별자: 로그인된 사용자는 email, 비로그인은 IP.
 * 호출자가 user.email을 알면 직접 넘기고, IP만 있으면 두 번째 인자에 IP 전달.
 */
export function rateLimitIdentifier(userEmail: string | null | undefined, ip: string | null | undefined): string {
  if (userEmail) return `user:${userEmail.toLowerCase()}`
  return `ip:${ip || "unknown"}`
}

export function getClientIp(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown"
  return headersList.get("x-real-ip") || "unknown"
}
