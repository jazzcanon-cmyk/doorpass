import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const email = user!.email
    const meta = user!.user_metadata as Record<string, unknown> | undefined
    const userId =
      ((meta?.provider_id as string | undefined) ??
        (meta?.sub as string | undefined) ??
        user!.id) as string

    let userData: { role: string | null; branch_id: string | null } | null = null
    if (email) {
      const { data } = await supabaseAdmin
        .from("approved_users")
        .select("role, branch_id")
        .eq("email", email)
        .maybeSingle()
      userData = data
    }
    if (!userData) {
      const { data } = await supabaseAdmin
        .from("approved_users")
        .select("role, branch_id")
        .eq("kakao_id", userId)
        .maybeSingle()
      userData = data
    }

    if (!userData || (userData.role !== "sub_admin" && userData.role !== "admin")) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 })
    }

    const isAdmin = userData.role === "admin"
    const branchId = userData.branch_id

    if (userData.role === "sub_admin" && !branchId) {
      // 대리점 미배정 부관리자도 전체 건물 수는 보여줌
      const { count: totalNoBranch } = await supabaseAdmin
        .from("buildings")
        .select("id", { count: "exact", head: true })
      return NextResponse.json({
        stats: {
          userCount: 0,
          buildingCount: 0,
          totalBuildingCount: totalNoBranch ?? 0,
          pendingApprovals: 0,
          recentUploads: 0,
        },
      })
    }

    const nowKst = new Date(Date.now() + 9 * 3600000)
    const startOfMonth = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), 1))
    const startIso = startOfMonth.toISOString()

    let usersQ = supabaseAdmin.from("approved_users").select("id", { count: "exact", head: true })
    if (!isAdmin) usersQ = usersQ.eq("branch_id", branchId as string)

    let buildingsQ = supabaseAdmin.from("buildings").select("id", { count: "exact", head: true })
    if (!isAdmin) buildingsQ = buildingsQ.eq("branch_id", branchId as string)

    // 전체 건물 수 (검색 화면 등 다른 곳과 동일한 SELECT COUNT(*) FROM buildings)
    const totalBuildingsQ = supabaseAdmin
      .from("buildings")
      .select("id", { count: "exact", head: true })

    let pendingQ = supabaseAdmin
      .from("pending_approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
    if (!isAdmin) pendingQ = pendingQ.eq("selected_branch_id", branchId as string)

    let uploadsQ = supabaseAdmin
      .from("buildings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startIso)
    if (!isAdmin) uploadsQ = uploadsQ.eq("branch_id", branchId as string)

    const [usersRes, buildingsRes, totalBuildingsRes, pendingRes, uploadsRes] = await Promise.all([
      usersQ,
      buildingsQ,
      totalBuildingsQ,
      pendingQ,
      uploadsQ,
    ])

    if (usersRes.error) throw usersRes.error
    if (buildingsRes.error) throw buildingsRes.error
    if (totalBuildingsRes.error) throw totalBuildingsRes.error
    if (pendingRes.error) throw pendingRes.error
    if (uploadsRes.error) throw uploadsRes.error

    return NextResponse.json({
      stats: {
        userCount: usersRes.count ?? 0,
        // 내 대리점 건물 (admin은 곧 전체와 동일)
        buildingCount: buildingsRes.count ?? 0,
        // 전체 건물 (앱 검색 화면과 동일한 카운트)
        totalBuildingCount: totalBuildingsRes.count ?? 0,
        pendingApprovals: pendingRes.count ?? 0,
        recentUploads: uploadsRes.count ?? 0,
      },
    })
  } catch (error) {
    console.error("[sub-admin/stats] 조회 실패:", (error as Error).message)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}
