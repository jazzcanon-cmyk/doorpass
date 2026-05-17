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

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    // 독립적인 쿼리 3개 병렬 실행
    const [usersRes, buildingCountRes, buildingsRes] = await Promise.all([
      supabaseAdmin.from("approved_users").select("email", { count: "exact" }).eq("branch_id", branchId),
      supabaseAdmin.from("buildings").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
      supabaseAdmin.from("buildings").select("region").eq("branch_id", branchId),
    ])

    const users = usersRes.data
    const userCount = usersRes.count
    const buildingCount = buildingCountRes.count

    const userEmails = (users || []).map((u) => u.email).filter((v): v is string => Boolean(v))

    // 로그인 이력 쿼리: recentLogins + allMonthlyRows 병렬
    let activeUsers = 0
    let allMonthlyRows: Array<{ login_at: string }> = []
    if (userEmails.length > 0) {
      const [recentLoginsRes, monthlyLoginsRes] = await Promise.all([
        supabaseAdmin.from("login_history").select("user_email").in("user_email", userEmails).gte("login_at", thirtyDaysAgo.toISOString()),
        supabaseAdmin.from("login_history").select("login_at").in("user_email", userEmails).gte("login_at", sixMonthsAgo.toISOString()),
      ])
      activeUsers = new Set((recentLoginsRes.data || []).map((l) => l.user_email).filter(Boolean)).size
      allMonthlyRows = monthlyLoginsRes.data ?? []
    }

    const loginCountByMonth = new Map<string, number>()
    for (const row of allMonthlyRows) {
      const key = row.login_at.slice(0, 7) // YYYY-MM
      loginCountByMonth.set(key, (loginCountByMonth.get(key) ?? 0) + 1)
    }

    const monthlyLogins: Array<{ month: string; count: number }> = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const month = date.toLocaleString("ko-KR", { month: "short" })
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      monthlyLogins.push({ month, count: loginCountByMonth.get(key) ?? 0 })
    }

    const buildingRegionMap = new Map<string, number>()
    for (const b of buildingsRes.data || []) {
      const region = String(b.region || "미분류")
      buildingRegionMap.set(region, (buildingRegionMap.get(region) || 0) + 1)
    }
    const buildingsByRegion = Array.from(buildingRegionMap.entries()).map(([region, count]) => ({ region, count }))

    // 최근 활동 + 관리자 이름 + 부관리자 목록 병렬 조회
    const [recentActivityRes, managerRes, subAdminRes] = await Promise.all([
      userEmails.length > 0
        ? supabaseAdmin.from("login_history").select("user_email, login_at").in("user_email", userEmails).order("login_at", { ascending: false }).limit(10)
        : Promise.resolve({ data: [] as Array<{ user_email: string; login_at: string }> }),
      branch.manager_email && !branch.manager_name
        ? supabaseAdmin.from("approved_users").select("name").eq("email", branch.manager_email).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin.from("approved_users").select("id, email, name, kakao_name, role").eq("branch_id", branchId).eq("role", "sub_admin").order("created_at", { ascending: false }),
    ])

    const recentActivities = (recentActivityRes.data || []).map((activity) => ({
      type: "로그인",
      user: activity.user_email,
      timestamp: activity.login_at,
      description: `${activity.user_email} 님이 로그인했습니다`,
    }))
    const resolvedManagerName: string | null = branch.manager_name ?? managerRes.data?.name ?? null
    const subAdminRows = subAdminRes.data

    return NextResponse.json({
      branch: {
        ...branch,
        manager_name: resolvedManagerName,
        sub_admins: subAdminRows ?? [],
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
    console.error("[admin/branches:detail] 조회 실패:", (error as Error).message)
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
    console.error("[admin/branches:update] 수정 실패:", (error as Error).message)
    return NextResponse.json({ error: "수정 실패" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const { branchId } = await params

    const [{ count: userCount }, { count: buildingCount }] = await Promise.all([
      supabaseAdmin.from("approved_users").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
      supabaseAdmin.from("buildings").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
    ])

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
    console.error("[admin/branches:delete] 삭제 실패:", (error as Error).message)
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 })
  }
}
