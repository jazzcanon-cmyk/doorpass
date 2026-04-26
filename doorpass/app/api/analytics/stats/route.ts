import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdminApi } from "@/lib/auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function toKSTDay(isoString: string): string {
  const d = new Date(isoString)
  const kst = new Date(d.getTime() + 9 * 3600_000)
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(kst.getUTCDate()).padStart(2, "0")
  return `${mm}/${dd}`
}

export async function GET() {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const since24h = new Date(Date.now() - 24 * 3600_000).toISOString()
    const since7d  = new Date(Date.now() - 7  * 24 * 3600_000).toISOString()

    const [searchesRes, recentRes, last24hRes, last7dRes] = await Promise.all([
      supabase.from("popular_searches").select("*").limit(10),
      supabase.from("user_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("user_activities")
        .select("action_type, created_at")
        .gte("created_at", since24h),
      supabase.from("user_activities")
        .select("action_type, created_at, metadata")
        .gte("created_at", since7d)
        .order("created_at", { ascending: true }),
    ])

    const rows7d = last7dRes.data ?? []

    // ── 최근 24시간: 시간대별 집계 ──
    const hourlyMap = new Map<string, number>()
    for (const row of last24hRes.data ?? []) {
      const h = new Date(row.created_at).toISOString().slice(0, 13)
      hourlyMap.set(h, (hourlyMap.get(h) ?? 0) + 1)
    }
    const hourlyActivity = Array.from(hourlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, count]) => ({ hour, count }))

    // 활동 유형별 (24시간)
    const typeMap = new Map<string, number>()
    for (const row of last24hRes.data ?? []) {
      typeMap.set(row.action_type, (typeMap.get(row.action_type) ?? 0) + 1)
    }
    const activityByType = Array.from(typeMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => ({ type, count }))

    // ── 7일: 일별 집계 ──
    const dailyMap = new Map<string, { search: number; view: number; click: number; total: number }>()
    for (let i = 6; i >= 0; i--) {
      const key = toKSTDay(new Date(Date.now() - i * 24 * 3600_000).toISOString())
      dailyMap.set(key, { search: 0, view: 0, click: 0, total: 0 })
    }
    for (const row of rows7d) {
      const key = toKSTDay(row.created_at)
      const e = dailyMap.get(key)
      if (!e) continue
      e.total++
      if (row.action_type === "search") e.search++
      else if (row.action_type === "button_click") e.click++
      else if (row.action_type === "building_view" || row.action_type === "post_view") e.view++
    }
    const dailyActivity = Array.from(dailyMap.entries()).map(([date, counts]) => ({ date, ...counts }))

    // ── 7일: 사용자별 집계 ──
    interface UserAccum { searches: number; clicks: number; views: number; total: number; lastActivity: string }
    const userMap = new Map<string, UserAccum>()
    for (const row of rows7d) {
      const meta = row.metadata as Record<string, unknown>
      const email = typeof meta?.userEmail === "string" ? meta.userEmail : null
      if (!email) continue
      if (!userMap.has(email)) userMap.set(email, { searches: 0, clicks: 0, views: 0, total: 0, lastActivity: row.created_at })
      const u = userMap.get(email)!
      u.total++
      u.lastActivity = row.created_at
      if (row.action_type === "search") u.searches++
      else if (row.action_type === "button_click") u.clicks++
      else if (row.action_type === "building_view" || row.action_type === "post_view") u.views++
    }
    const userStats = Array.from(userMap.entries())
      .map(([email, s]) => ({ email, ...s }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // ── 7일: 인기 건물 (고유 사용자 포함) ──
    const buildingMap = new Map<string, { name: string; views: number; users: Set<string> }>()
    for (const row of rows7d) {
      if (row.action_type !== "building_view") continue
      const meta = row.metadata as Record<string, unknown>
      const id   = String(meta?.buildingId ?? "")
      const name = String(meta?.buildingName ?? id)
      const email = String(meta?.userEmail ?? "")
      if (!id) continue
      if (!buildingMap.has(id)) buildingMap.set(id, { name, views: 0, users: new Set() })
      const b = buildingMap.get(id)!
      b.views++
      if (email) b.users.add(email)
    }
    const popularBuildings = Array.from(buildingMap.entries())
      .map(([id, { name, views, users }]) => ({
        building_id: id,
        building_name: name,
        view_count: views,
        unique_users: users.size,
      }))
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, 10)

    return NextResponse.json({
      popularSearches:  searchesRes.data ?? [],
      popularBuildings,
      recentActivities: recentRes.data ?? [],
      hourlyActivity,
      dailyActivity,
      activityByType,
      userStats,
      totalToday: last24hRes.data?.length ?? 0,
    })
  } catch (err) {
    console.error("[Analytics] stats error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
