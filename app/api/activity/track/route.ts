import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getIp } from "@/lib/activity-logger"
import { trackActivity, type ActivityType } from "@/lib/activity-tracker"

const ALLOWED: ActivityType[] = [
  "building_view",
  "search",
  "page_view",
  "password_decrypt",
  "login",
  "logout",
]

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = (await request.json().catch(() => ({}))) as {
    actionType?: string
    targetInfo?: Record<string, unknown>
    pageUrl?: string
  }

  if (!body.actionType || !ALLOWED.includes(body.actionType as ActivityType)) {
    return NextResponse.json({ error: "Invalid actionType" }, { status: 400 })
  }

  const result = await trackActivity({
    userEmail: user!.email ?? "",
    actionType: body.actionType as ActivityType,
    targetInfo: body.targetInfo ?? {},
    pageUrl: body.pageUrl,
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  })

  if (!result.success) {
    console.error("[activity/track] 활동 기록 저장 실패")
    return NextResponse.json({ success: false, skipped: true }, { status: 200 })
  }
  return NextResponse.json({ success: true })
}

