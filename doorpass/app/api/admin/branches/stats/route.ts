import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const { data: branches, error: branchesError } = await supabaseAdmin
      .from("branches")
      .select("*")
      .order("region")
      .order("name")

    if (branchesError) throw branchesError

    const branchesWithStats = await Promise.all(
      (branches || []).map(async (branch) => {
        const { data: users, count: userCount } = await supabaseAdmin
          .from("approved_users")
          .select("email", { count: "exact" })
          .eq("branch_id", branch.id)

        const { count: buildingCount } = await supabaseAdmin
          .from("buildings")
          .select("id", { count: "exact", head: true })
          .eq("branch_id", branch.id)

        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const emails = (users || []).map((u) => u.email).filter((v): v is string => Boolean(v))
        let activeUsers = 0
        if (emails.length > 0) {
          const { data: recentLogins } = await supabaseAdmin
            .from("login_history")
            .select("user_email")
            .in("user_email", emails)
            .gte("login_at", thirtyDaysAgo.toISOString())

          activeUsers = new Set((recentLogins || []).map((l) => l.user_email).filter(Boolean)).size
        }

        return {
          ...branch,
          stats: {
            userCount: userCount || 0,
            buildingCount: buildingCount || 0,
            activeUsers,
          },
        }
      })
    )

    return NextResponse.json({ branches: branchesWithStats })
  } catch (error) {
    console.error("[Branches Stats] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}
