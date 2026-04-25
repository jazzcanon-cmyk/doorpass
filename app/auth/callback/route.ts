import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", origin))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=exchange_failed", origin))
  }

  const provider = data.user.app_metadata?.provider
  const email = data.user.user_metadata?.email as string | undefined
  const kakaoId =
    data.user.user_metadata?.provider_id || data.user.user_metadata?.sub

  let approved: { id: string; is_active: boolean } | null = null

  if (provider === "kakao") {
    // 카카오: kakao_id로 조회 (기존 방식 유지)
    const { data: byKakao } = await supabase
      .from("approved_users")
      .select("id, is_active")
      .eq("kakao_id", kakaoId)
      .single()
    approved = byKakao

    // kakao_id로 못 찾으면 이메일로 재시도 (email 컬럼으로 등록된 경우)
    if (!approved && email) {
      const { data: byEmail } = await supabase
        .from("approved_users")
        .select("id, is_active")
        .eq("email", email)
        .single()
      approved = byEmail
    }
  } else if (provider === "google") {
    // 구글: 이메일로 조회
    if (email) {
      const { data: byEmail } = await supabase
        .from("approved_users")
        .select("id, is_active")
        .eq("email", email)
        .single()
      approved = byEmail
    }
  }

  if (!approved || !approved.is_active) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL("/login?error=unauthorized", origin))
  }

  return NextResponse.redirect(new URL("/", origin))
}
