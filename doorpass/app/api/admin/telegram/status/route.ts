import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"

export async function GET() {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  return NextResponse.json({
    botTokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    chatIdConfigured: Boolean(process.env.TELEGRAM_CHAT_ID),
    deployPlatform: process.env.VERCEL ? "vercel" : "local",
    nodeEnv: process.env.NODE_ENV,
  })
}
