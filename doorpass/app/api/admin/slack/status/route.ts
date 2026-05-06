import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"

export async function GET() {
  try {
    const { unauthorized } = await requireAdminApi()
    if (unauthorized) return unauthorized

    const webhookConfigured = Boolean(process.env.SLACK_WEBHOOK_URL?.trim())
    const nodeEnv = process.env.NODE_ENV ?? "development"
    const deployPlatform = process.env.VERCEL ? "vercel" : "local"

    return NextResponse.json({
      webhookConfigured,
      nodeEnv,
      deployPlatform,
    })
  } catch (error) {
    console.error("[slack/status] 오류:", (error as Error).message)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
