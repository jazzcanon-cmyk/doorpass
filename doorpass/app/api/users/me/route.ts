import { NextResponse } from "next/server"
import { requireAuth, getUserRole, canRevealBuildingPassword } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

const NO_STORE = {
  headers: {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
  },
}

// /api/me 와 동일 정보를 제공하는 alias (사용자 설정 페이지 호환용)
export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const role = await getUserRole(user!.email)

  try {
    const email = user!.email
    const meta = user!.user_metadata as Record<string, unknown> | undefined
    const userId =
      ((meta?.provider_id as string | undefined) ??
        (meta?.sub as string | undefined) ??
        user!.id) as string

    // branches 조인 제거: FK 미설정 환경에서 조인 실패 시 userData=null이 되는 문제 방지
    let userData: {
      id: string
      email: string | null
      name: string | null
      role: string | null
      branch_id: string | null
    } | null = null

    if (email) {
      const { data } = await supabaseAdmin
        .from("approved_users")
        .select("id, email, name, role, branch_id")
        .eq("email", email)
        .maybeSingle()
      userData = data
    }

    if (!userData) {
      const { data } = await supabaseAdmin
        .from("approved_users")
        .select("id, email, name, role, branch_id")
        .eq("kakao_id", userId)
        .maybeSingle()
      userData = data
    }

    if (!userData) {
      return NextResponse.json(
        {
          email: user!.email ?? null,
          role: null,
          branchId: null,
          canEdit: false,
          canUploadCSV: false,
          canRevealBuildingPassword: false,
          total_points: 0,
        },
        NO_STORE
      )
    }

    // branches 별도 조회 (FK 의존 없이)
    let branch = null
    if (userData.branch_id) {
      const { data: branchData } = await supabaseAdmin
        .from("branches")
        .select("id, name, region")
        .eq("id", userData.branch_id)
        .maybeSingle()
      branch = branchData ?? null
    }

    const canReveal = await canRevealBuildingPassword(user!.email)

    const { data: pointData } = await supabaseAdmin
      .from("user_points")
      .select("total_points")
      .eq("email", user!.email!)
      .maybeSingle()

    return NextResponse.json(
      {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        branchId: userData.branch_id,
        branch,
        canEdit: ["admin", "sub_admin", "editor"].includes(String(userData.role ?? role)),
        canUploadCSV: ["admin", "sub_admin"].includes(String(userData.role ?? role)),
        canRevealBuildingPassword: canReveal,
        total_points: pointData?.total_points ?? 0,
      },
      NO_STORE
    )
  } catch (error) {
    console.error("[Users Me] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}
