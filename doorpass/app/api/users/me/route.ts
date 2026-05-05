import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

const NO_STORE = {
  headers: {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  },
}

// /api/me 와 동일 정보 + loginCount / approvalStatus / welcomeShown 통합 제공
export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const email = user!.email
    const meta = user!.user_metadata as Record<string, unknown> | undefined
    const userId = (
      (meta?.provider_id as string | undefined) ??
      (meta?.sub as string | undefined) ??
      user!.id
    ) as string
    const identifier = email || userId

    // ① approved_users(email 기준) + login_history count 병렬 조회
    const [approvedByEmailResult, loginCountResult] = await Promise.all([
      email
        ? supabaseAdmin
            .from("approved_users")
            .select("id, email, name, role, branch_id, welcome_shown")
            .eq("email", email)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin
        .from("login_history")
        .select("id", { count: "exact", head: true })
        .eq("user_email", identifier),
    ])

    type ApprovedRow = {
      id: string
      email: string | null
      name: string | null
      role: string | null
      branch_id: string | null
      welcome_shown: boolean | null
    }
    let userData = approvedByEmailResult.data as ApprovedRow | null

    // kakao_id 폴백
    if (!userData) {
      const { data } = await supabaseAdmin
        .from("approved_users")
        .select("id, email, name, role, branch_id, welcome_shown")
        .eq("kakao_id", userId)
        .maybeSingle()
      userData = data as ApprovedRow | null
    }

    const loginCount = loginCountResult.count ?? 0
    // 최초 로그인 기록 (fire-and-forget, 실패 무시)
    if (loginCount === 0) {
      void supabaseAdmin.from("login_history").insert({ user_email: identifier })
    }

    // ② 미등록 사용자: pending_approvals 조회
    if (!userData) {
      let pendingApproval: { status: string; selected_branch_id: string } | null = null
      for (const id of [email, userId].filter(Boolean) as string[]) {
        const { data } = await supabaseAdmin
          .from("pending_approvals")
          .select("status, selected_branch_id")
          .eq("user_email", id)
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (data) {
          pendingApproval = data as { status: string; selected_branch_id: string }
          break
        }
      }

      return NextResponse.json(
        {
          email: user!.email ?? null,
          role: null,
          branchId: null,
          canEdit: false,
          canUploadCSV: false,
          canRevealBuildingPassword: false,
          total_points: 0,
          loginCount,
          approvalStatus: pendingApproval?.status ?? "none",
          welcomeShown: true, // 미등록 사용자는 환영 메시지 생략
        },
        NO_STORE
      )
    }

    // ③ 승인된 사용자: branch + user_points 병렬 조회
    const [branchResult, pointResult] = await Promise.all([
      userData.branch_id
        ? supabaseAdmin
            .from("branches")
            .select("id, name, region")
            .eq("id", userData.branch_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      email
        ? supabaseAdmin
            .from("user_points")
            .select("total_points")
            .eq("email", email)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    const role = userData.role ?? null
    // approved_users에 행 있고 role이 비어있지 않으면 비밀번호 공개
    const canReveal = !!(userData.id && role && String(role).trim() !== "")

    return NextResponse.json(
      {
        email: userData.email,
        name: userData.name,
        role,
        branchId: userData.branch_id,
        branch: branchResult.data ?? null,
        canEdit: ["admin", "sub_admin", "editor"].includes(String(role ?? "")),
        canUploadCSV: ["admin", "sub_admin"].includes(String(role ?? "")),
        canRevealBuildingPassword: canReveal,
        total_points: pointResult.data?.total_points ?? 0,
        loginCount,
        approvalStatus: "approved",
        welcomeShown: userData.welcome_shown ?? true,
      },
      NO_STORE
    )
  } catch (error) {
    console.error("[Users Me] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}
