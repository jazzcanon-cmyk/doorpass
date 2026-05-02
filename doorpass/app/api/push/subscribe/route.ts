import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  if (!user?.email) {
    return NextResponse.json({ error: "이메일이 없는 계정입니다." }, { status: 400 })
  }

  let body: { subscription?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 })
  }

  const subscription = body.subscription
  if (!subscription || typeof subscription !== "object") {
    return NextResponse.json({ error: "subscription이 필요합니다." }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .upsert(
      {
        user_email: user.email,
        subscription,
        updated_at: now,
      },
      { onConflict: "user_email" }
    )

  if (error) {
    console.error("[push/subscribe]", error)
    return NextResponse.json({ error: "구독 저장 실패" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
