import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"

export async function GET() {
  try {
    const { unauthorized } = await requireAdminApi()
    if (unauthorized) return unauthorized

    return NextResponse.json({
      botTokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      chatIdConfigured: Boolean(process.env.TELEGRAM_CHAT_ID),
      deployPlatform: process.env.VERCEL ? "vercel" : "local",
      nodeEnv: process.env.NODE_ENV,
    })
  } catch (error) {
    console.error("[telegram/status] 오류:", (error as Error).message)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
