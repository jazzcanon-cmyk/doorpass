import { NextResponse } from "next/server"
import { requireAuth, resolveUserEmail } from "@/lib/auth"
import { processAttendance } from "@/lib/attendance"
import { addPoints } from "@/lib/points"
import {
  generalLimiter,
  checkRateLimit,
  rateLimitIdentifier,
  getClientIp,
} from "@/lib/ratelimit"

const RATE_LIMIT_RESPONSE = NextResponse.json(
  { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
  { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
)

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const email = resolveUserEmail(user!)

  const rl = await checkRateLimit(
    generalLimiter,
    rateLimitIdentifier(email, getClientIp(request.headers))
  )
  if (!rl.success) return RATE_LIMIT_RESPONSE

  const result = await processAttendance(email)

  if (!result.success) {
    if (result.reason === "already_checked") {
      return NextResponse.json(
        { success: false, reason: "already_checked", message: "오늘은 이미 출석 체크를 완료하셨습니다." },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, reason: "error", message: "출석 체크에 실패했습니다." },
      { status: 500 }
    )
  }

  // 포인트 적립 (실패해도 출석 자체는 성공으로 응답)
  let pointTotal: number | null = null
  if (result.pointAction) {
    try {
      const pointResult = await addPoints({
        email,
        action: result.pointAction,
      })
      if (pointResult.success && typeof pointResult.newTotal === "number") {
        pointTotal = pointResult.newTotal
      }
    } catch (e) {
      console.error("[attendance] addPoints 실패:", (e as Error).message)
    }
  }

  return NextResponse.json({
    success: true,
    rewardPoints: result.rewardPoints,
    rewardType: result.rewardType,
    consecutiveDays: result.consecutiveDays,
    isBonusDay: result.isBonusDay,
    newTotal: pointTotal,
  })
}
