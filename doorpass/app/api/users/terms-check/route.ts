import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data } = await supabaseAdmin
    .from("terms_agreements")
    .select("id")
    .eq("user_email", user!.email)
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ agreed: data !== null })
}

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  const userAgent = request.headers.get("user-agent") ?? null

  const { error } = await supabaseAdmin.from("terms_agreements").insert({
    user_email: user!.email,
    ip_address: ip,
    user_agent: userAgent,
    version: "v1.0",
  })

  if (error) {
    return NextResponse.json({ error: "저장 실패" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
