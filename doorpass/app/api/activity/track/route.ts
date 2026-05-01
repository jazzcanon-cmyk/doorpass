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
    return NextResponse.json({ success: true, ignored: true })
  }

  try {
    await trackActivity({
      userEmail: user!.email ?? "",
      actionType: body.actionType as ActivityType,
      targetInfo: body.targetInfo ?? {},
      pageUrl: body.pageUrl,
      ipAddress: getIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    })
  } catch (err) {
    console.error("[Activity Track] 실패(무시):", err)
  }
  return NextResponse.json({ success: true })
}

