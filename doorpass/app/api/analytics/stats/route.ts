import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdminApi } from "@/lib/auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [searchesRes, buildingsRes, recentRes, last24hRes] = await Promise.all([
      supabase.from("popular_searches").select("*").limit(10),
      supabase.from("popular_buildings").select("*").limit(10),
      supabase.from("user_activities").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("user_activities")
        .select("activity_type, created_at")
        .gte("created_at", since24h)
        .order("created_at", { ascending: true }),
    ])

    // 시간대별 집계 (지난 24시간)
    const hourlyMap = new Map<string, number>()
    for (const row of last24hRes.data ?? []) {
      const h = new Date(row.created_at).toISOString().slice(0, 13)
      hourlyMap.set(h, (hourlyMap.get(h) ?? 0) + 1)
    }
    const hourlyActivity = Array.from(hourlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, count]) => ({ hour, count }))

    // 활동 유형별 집계 (지난 24시간)
    const typeMap = new Map<string, number>()
    for (const row of last24hRes.data ?? []) {
      typeMap.set(row.activity_type, (typeMap.get(row.activity_type) ?? 0) + 1)
    }
    const activityByType = Array.from(typeMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => ({ type, count }))

    return NextResponse.json({
      popularSearches: searchesRes.data ?? [],
      popularBuildings: buildingsRes.data ?? [],
      recentActivities: recentRes.data ?? [],
      hourlyActivity,
      activityByType,
      totalToday: last24hRes.data?.length ?? 0,
    })
  } catch (err) {
    console.error("[Analytics] stats error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
