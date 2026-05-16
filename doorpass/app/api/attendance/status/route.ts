import { NextResponse } from "next/server"
import { requireAuth, resolveUserEmail } from "@/lib/auth"
import { getAttendanceStats } from "@/lib/attendance"
import {
  generalLimiter,
  checkRateLimit,
  rateLimitIdentifier,
  getClientIp,
} from "@/lib/ratelimit"

export async function GET(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const email = resolveUserEmail(user!)

  const rl = await checkRateLimit(
    generalLimiter,
    rateLimitIdentifier(email, getClientIp(request.headers))
  )
  if (!rl.success) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다." },
      { status: 429 }
    )
  }

  try {
    const stats = await getAttendanceStats(email)
    return NextResponse.json(stats)
  } catch (e) {
    console.error("[attendance:status] 조회 실패:", (e as Error).message)
    return NextResponse.json(
      { error: "출석 상태 조회에 실패했습니다." },
      { status: 500 }
    )
  }
}
