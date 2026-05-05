import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase-route"

export async function GET() {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const supabase = await createSupabaseRouteHandlerClient()
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString()

  const [
    bldRes,
    usrRes,
    actRes,
    searchRes,
    pageViewRes,
    buildingViewRes,
  ] = await Promise.all([
    supabase.from("buildings").select("id", { count: "exact", head: true }),
    supabase.from("approved_users").select("id", { count: "exact", head: true }),
    supabase.from("user_activities").select("id", { count: "exact", head: true }).gte("created_at", since24h),
    supabase
      .from("user_activities")
      .select("id", { count: "exact", head: true })
      .eq("action_type", "search")
      .gte("created_at", since24h),
    supabase
      .from("user_activities")
      .select("id", { count: "exact", head: true })
      .eq("action_type", "page_view")
      .gte("created_at", since24h),
    supabase
      .from("user_activities")
      .select("id", { count: "exact", head: true })
      .eq("action_type", "building_view")
      .gte("created_at", since24h),
  ])

  return NextResponse.json({
    buildings: bldRes.count ?? 0,
    users: usrRes.count ?? 0,
    todayActivities: actRes.count ?? 0,
    todaySearches: searchRes.count ?? 0,
    todayPageViews: pageViewRes.count ?? 0,
    todayBuildingViews: buildingViewRes.count ?? 0,
  })
}
