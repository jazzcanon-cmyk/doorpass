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

    const { count: userCount } = await supabaseAdmin
      .from("approved_users")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", userData.branch_id)

    const { count: buildingCount } = await supabaseAdmin
      .from("buildings")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", userData.branch_id)

    const { count: pendingApprovals } = await supabaseAdmin
      .from("pending_approvals")
      .select("id", { count: "exact", head: true })
      .eq("selected_branch_id", userData.branch_id)
      .eq("status", "pending")

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: recentUploads } = await supabaseAdmin
      .from("buildings")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", userData.branch_id)
      .gte("created_at", startOfMonth.toISOString())

    return NextResponse.json({
      stats: {
        userCount: userCount || 0,
        buildingCount: buildingCount || 0,
        pendingApprovals: pendingApprovals || 0,
        recentUploads: recentUploads || 0,
      },
    })
  } catch (error) {
    console.error("[Sub-Admin Stats] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}
