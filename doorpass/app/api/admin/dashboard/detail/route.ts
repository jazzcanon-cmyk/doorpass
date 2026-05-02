import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data: me } = await supabaseAdmin
    .from("approved_users")
    .select("role")
    .eq("email", user!.email!)
    .single()

  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "관리자만 가능합니다." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") ?? ""

  try {
    if (type === "pageview") {
      const since24h = new Date(Date.now() - 24 * 3600_000).toISOString()
      const [listRes, hourlyRes] = await Promise.all([
        supabaseAdmin
          .from("user_activities")
          .select("id, metadata, created_at")
          .eq("action_type", "page_view")
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("user_activities")
          .select("created_at")
          .eq("action_type", "page_view")
          .gte("created_at", since24h),
      ])

      const hourly: Record<number, number> = {}
      for (let i = 0; i < 24; i++) hourly[i] = 0
      for (const row of hourlyRes.data ?? []) {
        const h = new Date(row.created_at).getHours()
        hourly[h] = (hourly[h] ?? 0) + 1
      }
      const hourlyData = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourly[h] }))

      return NextResponse.json({ list: listRes.data ?? [], hourlyData })
    }

    if (type === "search") {
      const { data: list } = await supabaseAdmin
        .from("user_activities")
        .select("id, metadata, created_at")
        .eq("action_type", "search")
        .order("created_at", { ascending: false })
        .limit(100)

      const countMap: Record<string, number> = {}
      for (const row of list ?? []) {
        const q = String((row.metadata as Record<string, unknown>)?.query ?? "")
        if (q) countMap[q] = (countMap[q] ?? 0) + 1
      }
      const topItems = Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([term, count]) => ({ term, count }))

      return NextResponse.json({ list: list ?? [], topItems })
    }

    if (type === "building_view") {
      const { data: list } = await supabaseAdmin
        .from("user_activities")
        .select("id, metadata, created_at")
        .eq("action_type", "building_view")
        .order("created_at", { ascending: false })
        .limit(100)

      const countMap: Record<string, number> = {}
      for (const row of list ?? []) {
        const name = String((row.metadata as Record<string, unknown>)?.buildingName ?? "")
        if (name) countMap[name] = (countMap[name] ?? 0) + 1
      }
      const topItems = Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }))

      return NextResponse.json({ list: list ?? [], topItems })
    }

    if (type === "activity") {
      const { data: list } = await supabaseAdmin
        .from("user_activities")
        .select("id, action_type, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(100)

      return NextResponse.json({ list: list ?? [] })
    }

    if (type === "buildings") {
      const [allRes, recentRes] = await Promise.all([
        supabaseAdmin.from("buildings").select("branch_id"),
        supabaseAdmin
          .from("buildings")
          .select("id, name, address, branch_id, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
      ])

      const countMap: Record<string, number> = {}
      for (const b of allRes.data ?? []) {
        const key = String(b.branch_id ?? "미분류")
        countMap[key] = (countMap[key] ?? 0) + 1
      }
      const topItems = Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .map(([branch_id, count]) => ({ branch_id, count }))

      return NextResponse.json({ list: recentRes.data ?? [], topItems })
    }

    if (type === "users") {
      const [usersRes, pointsRes] = await Promise.all([
        supabaseAdmin
          .from("approved_users")
          .select("id, email, name, role, managed_region, created_at")
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("user_points")
          .select("email, total_points")
          .order("total_points", { ascending: false })
          .limit(10),
      ])

      return NextResponse.json({
        list: usersRes.data ?? [],
        topItems: (pointsRes.data ?? []).map((p, i) => ({
          rank: i + 1,
          email: p.email,
          points: p.total_points,
        })),
      })
    }

    return NextResponse.json({ error: "unknown type" }, { status: 400 })
  } catch (e) {
    console.error("[dashboard/detail]", e)
    return NextResponse.json({ error: "서버 오류" }, { status: 500 })
  }
}
