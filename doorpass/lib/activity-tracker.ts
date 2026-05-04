import { supabaseAdmin } from "./supabase-admin"

export type ActivityType =
  | "building_view"
  | "search"
  | "page_view"
  | "password_decrypt"
  | "password_update"
  | "login"
  | "logout"

interface TrackActivityParams {
  userEmail: string
  actionType: ActivityType
  targetInfo?: Record<string, unknown>
  pageUrl?: string
  ipAddress?: string
  userAgent?: string
}

export async function trackActivity({
  userEmail,
  actionType,
  targetInfo = {},
  pageUrl,
  ipAddress,
  userAgent,
}: TrackActivityParams) {
  try {
    const { error } = await supabaseAdmin.from("user_activity_logs").insert({
      user_email: userEmail,
      activity_type: actionType,
      activity_data: { ...targetInfo, page_url: pageUrl ?? null, user_agent: userAgent ?? null },
      ip_address: ipAddress ?? null,
    })

    if (error) {
      console.error("[Activity Tracker] 저장 실패:", error)
      return { success: false, error }
    }
    return { success: true }
  } catch (err) {
    console.error("[Activity Tracker] 오류:", err)
    return { success: false, error: err }
  }
}

export async function getUserActivities(userEmail: string, limit: number = 100) {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_activity_logs")
      .select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[Activity Tracker] 조회 실패:", error)
      return { data: null, error }
    }
    return { data, error: null }
  } catch (err) {
    console.error("[Activity Tracker] 조회 오류:", err)
    return { data: null, error: err }
  }
}

