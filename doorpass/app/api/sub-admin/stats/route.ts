import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { data: userData } = await supabaseAdmin
      .from("approved_users")
      .select("role, branch_id")
      .eq("email", user!.email)
      .maybeSingle()

    if (!userData || (userData.role !== "sub_admin" && userData.role !== "admin")) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 })
    }

    const isAdmin = userData.role === "admin"
    const branchId = userData.branch_id

    if (userData.role === "sub_admin" && !branchId) {
      return NextResponse.json({
        stats: {
          userCount: 0,
          buildingCount: 0,
          pendingApprovals: 0,
          recentUploads: 0,
        },
      })
    }

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const startIso = startOfMonth.toISOString()

    let usersQ = supabaseAdmin.from("approved_users").select("id", { count: "exact", head: true })
    if (!isAdmin) usersQ = usersQ.eq("branch_id", branchId as string)

    let buildingsQ = supabaseAdmin.from("buildings").select("id", { count: "exact", head: true })
    if (!isAdmin) buildingsQ = buildingsQ.eq("branch_id", branchId as string)

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

    const [usersRes, buildingsRes, pendingRes, uploadsRes] = await Promise.all([
      usersQ,
      buildingsQ,
      pendingQ,
      uploadsQ,
    ])

    if (usersRes.error) throw usersRes.error
    if (buildingsRes.error) throw buildingsRes.error
    if (pendingRes.error) throw pendingRes.error
    if (uploadsRes.error) throw uploadsRes.error

    return NextResponse.json({
      stats: {
        userCount: usersRes.count ?? 0,
        buildingCount: buildingsRes.count ?? 0,
        pendingApprovals: pendingRes.count ?? 0,
        recentUploads: uploadsRes.count ?? 0,
      },
    })
  } catch (error) {
    console.error("[Sub-Admin Stats] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}
