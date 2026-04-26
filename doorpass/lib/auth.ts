import { createServerClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { redirect } from "next/navigation"
import { fetchApprovedUserForAuth } from "@/lib/approved-user-match"

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

/**
 * API 라우트에서 세션 + 차단 여부를 검증하는 헬퍼.
 * - 미인증: 401
 * - approved_users에 본인 행이 있고 is_active=false(차단 목록): 403
 * - 그 외(미등록 포함): 로그인만 되어 있으면 허용
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

  const approved = await fetchApprovedUserForAuth<{ id: string; is_active: boolean }>(
    supabase,
    user as User,
    "id, is_active"
  )

  if (approved && approved.is_active === false) {
    return {
      user: null,
      unauthorized: NextResponse.json(
        { error: "관리자에 의해 사용이 제한된 계정입니다." },
        { status: 403 }
      ),
    }
  }

  return { user, unauthorized: null }
}

/**
 * API 라우트에서 어드민 여부를 검증하는 헬퍼.
 * - 미인증: 401 / 차단·비어드민: 403 / 정상: user 반환
 */
export async function requireAdminApi() {
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

  const approved = await fetchApprovedUserForAuth<{ id: string; is_active: boolean; role: string }>(
    supabase,
    user as User,
    "id, is_active, role"
  )

  if (approved && approved.is_active === false) {
    return {
      user: null,
      unauthorized: NextResponse.json(
        { error: "관리자에 의해 사용이 제한된 계정입니다." },
        { status: 403 }
      ),
    }
  }

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

  const approved = await fetchApprovedUserForAuth<{ id: string; is_active: boolean; role: string }>(
    supabase,
    user as User,
    "id, is_active, role"
  )

  if (approved && approved.is_active === false) {
    redirect("/")
  }

  if (!approved || approved.role !== "admin") {
    redirect("/")
  }
}
