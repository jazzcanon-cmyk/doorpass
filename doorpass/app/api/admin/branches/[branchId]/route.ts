import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type Params = Promise<{ branchId: string }>

export async function GET(_request: Request, { params }: { params: Params }) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const { branchId } = await params

    const { data: branch, error: branchError } = await supabaseAdmin
      .from("branches")
      .select("*")
      .eq("id", branchId)
      .maybeSingle()

    if (branchError) throw branchError
    if (!branch) {
      return NextResponse.json({ error: "대리점을 찾을 수 없습니다" }, { status: 404 })
    }

    const { data: users, count: userCount } = await supabaseAdmin
      .from("approved_users")
      .select("email", { count: "exact" })
      .eq("branch_id", branchId)

    const { count: buildingCount } = await supabaseAdmin
      .from("buildings")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)

    const userEmails = (users || []).map((u) => u.email).filter((v): v is string => Boolean(v))
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let activeUsers = 0
    if (userEmails.length > 0) {
      const { data: recentLogins } = await supabaseAdmin
        .from("login_history")
        .select("user_email")
        .in("user_email", userEmails)
        .gte("login_at", thirtyDaysAgo.toISOString())
      activeUsers = new Set((recentLogins || []).map((l) => l.user_email).filter(Boolean)).size
    }

    const monthlyLogins: Array<{ month: string; count: number }> = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const month = date.toLocaleString("ko-KR", { month: "short" })
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)

      let count = 0
      if (userEmails.length > 0) {
        const { count: monthlyCount } = await supabaseAdmin
          .from("login_history")
          .select("id", { count: "exact", head: true })
          .in("user_email", userEmails)
          .gte("login_at", startOfMonth.toISOString())
          .lte("login_at", endOfMonth.toISOString())
        count = monthlyCount || 0
      }

      monthlyLogins.push({ month, count })
    }

    const { data: buildings } = await supabaseAdmin
      .from("buildings")
      .select("region")
      .eq("branch_id", branchId)

    const buildingRegionMap = new Map<string, number>()
    for (const b of buildings || []) {
      const region = String(b.region || "미분류")
      buildingRegionMap.set(region, (buildingRegionMap.get(region) || 0) + 1)
    }
    const buildingsByRegion = Array.from(buildingRegionMap.entries()).map(([region, count]) => ({ region, count }))

    let recentActivities: Array<{ type: string; user: string; timestamp: string; description: string }> = []
    if (userEmails.length > 0) {
      const { data: recentActivity } = await supabaseAdmin
        .from("login_history")
        .select("user_email, login_at")
        .in("user_email", userEmails)
        .order("login_at", { ascending: false })
        .limit(10)

      recentActivities = (recentActivity || []).map((activity) => ({
        type: "로그인",
        user: activity.user_email,
        timestamp: activity.login_at,
        description: `${activity.user_email} 님이 로그인했습니다`,
      }))
    }

    // approved_users에서 실제 이름 조회 (branches.manager_name이 null일 수 있으므로)
    let resolvedManagerName: string | null = branch.manager_name ?? null
    if (branch.manager_email && !resolvedManagerName) {
      const { data: managerUser } = await supabaseAdmin
        .from("approved_users")
        .select("name")
        .eq("email", branch.manager_email)
        .maybeSingle()
      resolvedManagerName = managerUser?.name ?? null
    }

    return NextResponse.json({
      branch: {
        ...branch,
        manager_name: resolvedManagerName,
        stats: {
          userCount: userCount || 0,
          buildingCount: buildingCount || 0,
          activeUsers,
          monthlyLogins,
          buildingsByRegion,
          recentActivities,
        },
      },
    })
  } catch (error) {
    console.error("[Branch Detail] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Params }) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const { branchId } = await params
    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      region?: string
      manager_email?: string
    }
    const name = String(body.name ?? "").trim()
    const region = String(body.region ?? "").trim()
    const managerEmail = String(body.manager_email ?? "").trim() || null

    if (!name || !region) {
      return NextResponse.json({ error: "name, region은 필수입니다." }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from("branches")
      .update({
        name,
        region,
        manager_email: managerEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", branchId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Branch Update] 오류:", error)
    return NextResponse.json({ error: "수정 실패" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const { branchId } = await params

    const { count: userCount } = await supabaseAdmin
      .from("approved_users")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)

    const { count: buildingCount } = await supabaseAdmin
      .from("buildings")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)

    if ((userCount || 0) > 0 || (buildingCount || 0) > 0) {
      return NextResponse.json(
        { error: "회원 또는 건물이 연결되어 있어 삭제할 수 없습니다" },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from("branches")
      .delete()
      .eq("id", branchId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Branch Delete] 오류:", error)
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 })
  }
}
