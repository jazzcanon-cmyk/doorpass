import { createServerClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { redirect } from "next/navigation"
import { fetchApprovedUserForAuth } from "@/lib/approved-user-match"
import { supabaseAdmin } from "@/lib/supabase-admin"

export type UserRole = "admin" | "sub_admin" | "editor" | "driver"

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
      isAdmin: false,
      unauthorized: NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      ),
    }
  }

  const approved = await fetchApprovedUserForAuth<{
    id: string
    is_active: boolean
    is_blocked: boolean
    role: string
  }>(supabase, user as User, "id, is_active, is_blocked, role")

  if (approved?.is_blocked) {
    return {
      user: null,
      isAdmin: false,
      unauthorized: NextResponse.json(
        { error: "차단된 계정입니다." },
        { status: 403 }
      ),
    }
  }

  if (approved && approved.is_active === false) {
    return {
      user: null,
      isAdmin: false,
      unauthorized: NextResponse.json(
        { error: "관리자에 의해 사용이 제한된 계정입니다." },
        { status: 403 }
      ),
    }
  }

  return { user, isAdmin: approved?.role === "admin", unauthorized: null }
}

/**
 * 사용자 식별자(provider_id 또는 sub 또는 id)를 일관되게 추출.
 * 캘린더 메모의 kakao_id 등 사용자 소유 row 비교에 사용.
 */
export function getUserIdentifier(user: User): string {
  return (
    (user.user_metadata?.provider_id as string | undefined) ??
    (user.user_metadata?.sub as string | undefined) ??
    user.id
  )
}

/**
 * 사용자 닉네임(user_metadata.name 우선) 추출. posts.author와 비교용.
 */
export function getUserName(user: User): string {
  const meta = user.user_metadata ?? {}
  return (
    (meta.name as string | undefined) ??
    (meta.full_name as string | undefined) ??
    (user.email ? user.email.split("@")[0] : "익명")
  )
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

  const approved = await fetchApprovedUserForAuth<{
    id: string
    is_active: boolean
    is_blocked: boolean
    role: string
  }>(supabase, user as User, "id, is_active, is_blocked, role")

  if (approved?.is_blocked) {
    return {
      user: null,
      unauthorized: NextResponse.json({ error: "차단된 계정입니다." }, { status: 403 }),
    }
  }

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
 * 부관리자는 /sub-admin 으로, 그 외 비관리자·비승인은 루트('/')로 리다이렉트합니다.
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

  const approved = await fetchApprovedUserForAuth<{
    id: string
    is_active: boolean
    is_blocked: boolean
    role: string
  }>(supabase, user as User, "id, is_active, is_blocked, role")

  if (approved?.is_blocked) {
    redirect("/")
  }

  if (approved && approved.is_active === false) {
    redirect("/")
  }

  if (approved?.role === "sub_admin") {
    redirect("/sub-admin")
  }

  if (!approved || approved.role !== "admin") {
    redirect("/")
  }
}

/**
 * admin 또는 sub_admin 전용 페이지 보호.
 */
export async function requireManager() {
  const cookieStore = await cookies()
  const supabase = makeSupabaseServer(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const approved = await fetchApprovedUserForAuth<{
    id: string
    is_active: boolean
    is_blocked: boolean
    role: string
  }>(supabase, user as User, "id, is_active, is_blocked, role")

  if (approved?.is_blocked) {
    redirect("/")
  }

  if (approved && approved.is_active === false) {
    redirect("/")
  }

  if (!approved || (approved.role !== "admin" && approved.role !== "sub_admin")) {
    redirect("/")
  }
}

/**
 * API 라우트에서 admin 또는 sub_admin 권한 검증.
 */
export async function requireManagerApi() {
  const cookieStore = await cookies()
  const supabase = makeSupabaseServer(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      role: null as UserRole | null,
      unauthorized: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }),
    }
  }

  const approved = await fetchApprovedUserForAuth<{
    id: string
    is_active: boolean
    is_blocked: boolean
    role: string
  }>(supabase, user as User, "id, is_active, is_blocked, role")

  if (approved?.is_blocked) {
    return {
      user: null,
      role: null as UserRole | null,
      unauthorized: NextResponse.json({ error: "차단된 계정입니다." }, { status: 403 }),
    }
  }

  if (approved && approved.is_active === false) {
    return {
      user: null,
      role: null as UserRole | null,
      unauthorized: NextResponse.json({ error: "관리자에 의해 사용이 제한된 계정입니다." }, { status: 403 }),
    }
  }

  if (!approved || (approved.role !== "admin" && approved.role !== "sub_admin")) {
    return {
      user: null,
      role: null as UserRole | null,
      unauthorized: NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }),
    }
  }

  const role = approved.role === "admin" || approved.role === "sub_admin" ? approved.role : "driver"
  return { user, role: role as UserRole, unauthorized: null }
}

/**
 * approved_users 테이블에서 사용자 역할 조회.
 * 미등록 사용자는 'driver' 기본값.
 */
export async function getUserRole(userEmail: string | null | undefined): Promise<UserRole> {
  if (!userEmail) return "driver"
  const { data } = await supabaseAdmin
    .from("approved_users")
    .select("role")
    .eq("email", userEmail)
    .maybeSingle()
  const role = (data?.role as string | undefined) ?? "driver"
  if (role === "admin" || role === "sub_admin" || role === "editor") return role
  return "driver"
}

/**
 * 건물 정보 수정 권한 (admin / sub_admin / editor)
 */
export async function canEditBuilding(userEmail: string | null | undefined): Promise<boolean> {
  const role = await getUserRole(userEmail)
  return role === "admin" || role === "sub_admin" || role === "editor"
}

/**
 * 엑셀(CSV) 업로드 권한 (admin / sub_admin)
 */
export async function canUploadCSV(userEmail: string | null | undefined): Promise<boolean> {
  const role = await getUserRole(userEmail)
  return role === "admin" || role === "sub_admin"
}

/**
 * 사용자 승인 권한 (admin / sub_admin)
 */
export async function canApproveUsers(userEmail: string | null | undefined): Promise<boolean> {
  const role = await getUserRole(userEmail)
  return role === "admin" || role === "sub_admin"
}

/**
 * 권한 요청 승인 권한 (admin)
 */
export async function canApproveRoleRequests(userEmail: string | null | undefined): Promise<boolean> {
  const role = await getUserRole(userEmail)
  return role === "admin"
}

/**
 * 부관리자 지정 권한 (admin)
 */
export async function canAssignSubAdmin(userEmail: string | null | undefined): Promise<boolean> {
  const role = await getUserRole(userEmail)
  return role === "admin"
}
