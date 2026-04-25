import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { redirect } from "next/navigation"

function makeSupabaseServer(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 읽기 전용 컨텍스트에서는 무시
          }
        },
      },
    }
  )
}

type SupabaseServer = ReturnType<typeof makeSupabaseServer>
type UserLike = { app_metadata?: Record<string, string>; user_metadata?: Record<string, string> }

// 카카오 또는 구글 사용자를 approved_users 테이블에서 조회
async function findApprovedUser<T extends Record<string, unknown>>(
  supabase: SupabaseServer,
  user: UserLike,
  columns: string
): Promise<T | null> {
  const provider = user.app_metadata?.provider
  const email = user.user_metadata?.email
  const kakaoId = user.user_metadata?.provider_id || user.user_metadata?.sub

  if (provider === "kakao") {
    const { data: byKakao } = await supabase
      .from("approved_users")
      .select(columns)
      .eq("kakao_id", kakaoId)
      .single()
    if (byKakao) return byKakao as unknown as T

    if (email) {
      const { data: byEmail } = await supabase
        .from("approved_users")
        .select(columns)
        .eq("email", email)
        .single()
      return byEmail ? (byEmail as unknown as T) : null
    }
    return null
  }

  if (provider === "google" && email) {
    const { data: byEmail } = await supabase
      .from("approved_users")
      .select(columns)
      .eq("email", email)
      .single()
    return byEmail ? (byEmail as unknown as T) : null
  }

  return null
}

/**
 * API 라우트에서 세션 + 승인 여부를 검증하는 헬퍼.
 * - 미인증: 401
 * - 승인되지 않은 사용자(is_active=false 또는 미등록): 403
 * - 정상: user 반환
 */
export async function requireAuth() {
  const cookieStore = await cookies()
  const supabase = makeSupabaseServer(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      unauthorized: NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      ),
    }
  }

  const approved = await findApprovedUser<{ id: string; is_active: boolean }>(
    supabase,
    user,
    "id, is_active"
  )

  if (!approved || !approved.is_active) {
    return {
      user: null,
      unauthorized: NextResponse.json(
        { error: "접근 권한이 없습니다." },
        { status: 403 }
      ),
    }
  }

  return { user, unauthorized: null }
}

/**
 * API 라우트에서 어드민 여부를 검증하는 헬퍼.
 * - 미인증: 401 / 비활성·비어드민: 403 / 정상: user 반환
 */
export async function requireAdminApi() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return { user: null, unauthorized }

  const cookieStore = await cookies()
  const supabase = makeSupabaseServer(cookieStore)

  const approved = await findApprovedUser<{ role: string }>(supabase, user!, "role")

  if (!approved || approved.role !== "admin") {
    return {
      user: null,
      unauthorized: NextResponse.json(
        { error: "어드민 권한이 필요합니다." },
        { status: 403 }
      ),
    }
  }

  return { user, unauthorized: null }
}

/**
 * 어드민 전용 페이지에서 사용하는 헬퍼.
 * role이 'admin'이 아니면 루트('/')로 리다이렉트합니다.
 */
export async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = makeSupabaseServer(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const approved = await findApprovedUser<{ id: string; is_active: boolean; role: string }>(
    supabase,
    user,
    "id, is_active, role"
  )

  if (!approved || !approved.is_active || approved.role !== "admin") {
    redirect("/")
  }
}
