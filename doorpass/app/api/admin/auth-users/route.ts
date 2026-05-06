import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAdminApi } from "@/lib/auth"

export async function GET() {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const {
      data: { users: authUsers },
      error: authError,
    } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (authError) throw authError

    const { data: approvedUsers, error: approvedError } = await supabaseAdmin
      .from("approved_users")
      .select("id, email, kakao_id, role, is_active, is_blocked, blocked_reason")
    if (approvedError) throw approvedError

    // 이메일 맵 + kakao_id 맵 둘 다 구성 (카카오 사용자는 이메일 없이 kakao_id만 등록된 경우가 많음)
    const byEmail = new Map(
      (approvedUsers ?? [])
        .filter((u) => u.email)
        .map((u) => [u.email!.toLowerCase(), u])
    )
    const byKakaoId = new Map(
      (approvedUsers ?? [])
        .filter((u) => u.kakao_id)
        .map((u) => [u.kakao_id!, u])
    )

    const users = authUsers.map((u) => {
      const email = u.email?.toLowerCase() ?? ""

      // 이메일 매칭 → 카카오 provider_id 매칭 순으로 fallback
      const providerId =
        (u.user_metadata?.provider_id as string | undefined) ??
        (u.user_metadata?.sub as string | undefined)
      const approved =
        (email ? byEmail.get(email) : undefined) ??
        (providerId ? byKakaoId.get(providerId) : undefined)

      const provider = (u.app_metadata?.provider as string | undefined) ?? "unknown"
      return {
        id: u.id,
        email: u.email ?? null,
        name:
          (u.user_metadata?.name as string | undefined) ??
          (u.user_metadata?.full_name as string | undefined) ??
          null,
        avatar_url: (u.user_metadata?.avatar_url as string | undefined) ?? null,
        provider,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        role: approved?.role ?? null,
        is_active: approved?.is_active ?? null,
        is_registered: !!approved,
        approved_id: approved?.id ?? null,
        is_blocked: approved?.is_blocked ?? false,
        blocked_reason: approved?.blocked_reason ?? null,
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error("[admin/auth-users] 조회 실패:", (error as Error).message)
    return NextResponse.json({ error: "Failed to fetch auth users" }, { status: 500 })
  }
}
