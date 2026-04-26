import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"

export async function GET() {
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
}
