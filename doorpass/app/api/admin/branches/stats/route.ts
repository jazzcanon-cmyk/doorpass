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

    // manager_email 목록을 한 번에 조회해서 이름 매핑
    const managerEmails = (branches || [])
      .map((b) => b.manager_email)
      .filter((e): e is string => Boolean(e))

    const managerNameMap: Record<string, string> = {}
    if (managerEmails.length > 0) {
      const { data: managers } = await supabaseAdmin
        .from("approved_users")
        .select("email, name")
        .in("email", managerEmails)
      for (const m of managers || []) {
        if (m.email && m.name) managerNameMap[m.email] = m.name
      }
    }

    // N+1 방지: 모든 지점의 사용자·건물·활성유저를 3개 쿼리로 한번에 조회
    const [allUsersRes, allBuildingsRes] = await Promise.all([
      supabaseAdmin.from("approved_users").select("email, branch_id").not("branch_id", "is", null),
      supabaseAdmin.from("buildings").select("branch_id").not("branch_id", "is", null),
    ])

    const branchEmailsMap = new Map<string, string[]>()
    for (const u of allUsersRes.data ?? []) {
      if (!u.branch_id || !u.email) continue
      if (!branchEmailsMap.has(u.branch_id)) branchEmailsMap.set(u.branch_id, [])
      branchEmailsMap.get(u.branch_id)!.push(u.email)
    }

    const buildingCountMap = new Map<string, number>()
    for (const b of allBuildingsRes.data ?? []) {
      if (!b.branch_id) continue
      buildingCountMap.set(b.branch_id, (buildingCountMap.get(b.branch_id) ?? 0) + 1)
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const allEmails = Array.from(new Set([...branchEmailsMap.values()].flat()))

    const activeEmailSet = new Set<string>()
    if (allEmails.length > 0) {
      const { data: recentLogins } = await supabaseAdmin
        .from("login_history")
        .select("user_email")
        .in("user_email", allEmails)
        .gte("login_at", thirtyDaysAgo.toISOString())
      for (const l of recentLogins ?? []) {
        if (l.user_email) activeEmailSet.add(l.user_email)
      }
    }

    const branchesWithStats = (branches || []).map((branch) => {
      const branchEmails = branchEmailsMap.get(branch.id) ?? []
      const resolvedName = branch.manager_email
        ? (managerNameMap[branch.manager_email] ?? branch.manager_name ?? null)
        : null
      return {
        ...branch,
        manager_name: resolvedName,
        stats: {
          userCount: branchEmails.length,
          buildingCount: buildingCountMap.get(branch.id) ?? 0,
          activeUsers: branchEmails.filter((e) => activeEmailSet.has(e)).length,
        },
      }
    })

    return NextResponse.json({ branches: branchesWithStats })
  } catch (error) {
    console.error("[admin/branches/stats] 조회 실패:", (error as Error).message)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}
