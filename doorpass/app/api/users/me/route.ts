import { NextResponse } from "next/server"
import { requireAuth, getUserRole, canRevealBuildingPassword } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

// /api/me 와 동일 정보를 제공하는 alias (사용자 설정 페이지 호환용)
export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const role = await getUserRole(user!.email)

  try {
    const { data: userData } = await supabaseAdmin
      .from("approved_users")
      .select(`
        *,
        branches (
          id,
          name,
          region
        )
      `)
      .eq("email", user!.email)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json({
        email: user!.email ?? null,
        role: null,
        branchId: null,
        canEdit: false,
        canUploadCSV: false,
        canRevealBuildingPassword: false,
      })
    }

    const canReveal = await canRevealBuildingPassword(user!.email)

    const { data: pointData } = await supabaseAdmin
      .from("user_points")
      .select("total_points")
      .eq("email", user!.email!)
      .single()

    return NextResponse.json({
      email: userData.email,
      name: userData.name,
      role: userData.role,
      branchId: userData.branch_id,
      branch: userData.branches ?? null,
      canEdit: ["admin", "sub_admin", "editor"].includes(String(userData.role ?? role)),
      canUploadCSV: ["admin", "sub_admin"].includes(String(userData.role ?? role)),
      canRevealBuildingPassword: canReveal,
      total_points: pointData?.total_points ?? 0,
    })
  } catch (error) {
    console.error("[Users Me] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}
