import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SLACK_WEBHOOK_URL",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
] as const

const REQUIRED = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SLACK_WEBHOOK_URL",
])

export async function GET() {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const vars = KEYS.map((key) => ({
    key,
    set: Boolean(process.env[key]?.trim()),
    required: REQUIRED.has(key),
  }))

  return NextResponse.json({ vars })
}
