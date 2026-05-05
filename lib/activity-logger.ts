import { supabaseAdmin } from "@/lib/supabase-admin"

export function logActivity(
  userEmail: string,
  activityType: string,
  activityData: Record<string, unknown> = {},
  ipAddress?: string
): void {
  void supabaseAdmin
    .from("user_activity_logs")
    .insert({
      user_email: userEmail,
      activity_type: activityType,
      activity_data: activityData,
      ip_address: ipAddress ?? null,
    })
    .then(({ error }) => { if (error) console.error("[logActivity]", error.message) })
}

export function getIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined
  )
}
