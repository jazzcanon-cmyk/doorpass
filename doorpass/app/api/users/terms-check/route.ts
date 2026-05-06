import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const email = user!.email
  const meta = user!.user_metadata as Record<string, unknown> | undefined
  const userId =
    (meta?.provider_id as string | undefined) ??
    (meta?.sub as string | undefined) ??
    user!.id

  // 1. terms_agreements 테이블에서 확인
  if (email) {
    const { data } = await supabaseAdmin
      .from("terms_agreements")
      .select("id")
      .eq("user_email", email)
      .limit(1)
      .maybeSingle()

    if (data) return NextResponse.json({ agreed: true })
  }

  // 2. approved_users에 있으면 이미 승인된 회원 → 동의한 것으로 간주
  const { data: approvedByEmail } = email
    ? await supabaseAdmin
        .from("approved_users")
        .select("id")
        .eq("email", email)
        .maybeSingle()
    : { data: null }

  const { data: approvedByKakao } = await supabaseAdmin
    .from("approved_users")
    .select("id")
    .eq("kakao_id", userId)
    .maybeSingle()

  if (approvedByEmail || approvedByKakao) {
    if (email) {
      await supabaseAdmin
        .from("terms_agreements")
        .upsert(
          { user_email: email, version: "v1.0" },
          { onConflict: "user_email" }
        )
        .then(() => undefined, () => undefined)
    }
    return NextResponse.json({ agreed: true })
  }

  return NextResponse.json({ agreed: false })
}

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const email = user!.email
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  const userAgent = request.headers.get("user-agent") ?? null

  if (!email) {
    // 이메일 없는 카카오 사용자는 동의한 것으로 처리 (저장 불가)
    return NextResponse.json({ success: true })
  }

  const { error } = await supabaseAdmin.from("terms_agreements").upsert(
    {
      user_email: email,
      ip_address: ip,
      user_agent: userAgent,
      version: "v1.0",
    },
    { onConflict: "user_email" }
  )

  if (error) {
    console.error("[users/terms-check] 저장 실패:", (error as Error).message)
    return NextResponse.json({ error: "저장 실패" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
