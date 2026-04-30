import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

const ANOMALY_THRESHOLD = 50
const ANOMALY_WINDOW_MS = 60 * 60 * 1000 // 1시간

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = (await request.json().catch(() => ({}))) as {
    building_id?: string | number
    building_name?: string
    building_address?: string
  }

  const userEmail = user!.email ?? ""
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  const userAgent = request.headers.get("user-agent") ?? null

  // 로그 저장
  const { error: insertError } = await supabaseAdmin.from("user_activity_logs").insert({
    user_email: userEmail,
    activity_type: "building_view",
    activity_data: {
      building_id: body.building_id ?? null,
      building_name: body.building_name ?? null,
      building_address: body.building_address ?? null,
    },
    ip_address: ip,
    user_agent: userAgent,
  })

  if (insertError) {
    console.error("[log-view] insert error:", insertError.message)
    return NextResponse.json({ error: "로그 저장 실패" }, { status: 500 })
  }

  // 이상 대량 조회 감지 (백그라운드, 응답 블로킹 없이)
  void detectAnomaly(userEmail, ip)

  return NextResponse.json({ success: true })
}

async function detectAnomaly(userEmail: string, ip: string | null) {
  try {
    const oneHourAgo = new Date(Date.now() - ANOMALY_WINDOW_MS).toISOString()

    const { count } = await supabaseAdmin
      .from("user_activity_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_email", userEmail)
      .eq("activity_type", "building_view")
      .gte("created_at", oneHourAgo)

    if ((count ?? 0) < ANOMALY_THRESHOLD) return

    // 이미 차단된 사용자면 스킵
    const { data: existing } = await supabaseAdmin
      .from("approved_users")
      .select("is_blocked")
      .eq("email", userEmail)
      .maybeSingle()

    if (!existing || existing.is_blocked === true) return

    // 자동 차단
    await supabaseAdmin
      .from("approved_users")
      .update({
        is_blocked: true,
        blocked_at: new Date().toISOString(),
        blocked_reason: `이상 대량 조회 자동 차단 (최근 1시간 내 ${count}건)`,
        blocked_by: null,
      })
      .eq("email", userEmail)

    // 텔레그램 알림
    sendTelegramMessage(
      `🚨 [이상 감지] ${userEmail}\n최근 1시간 ${count}개 건물 조회\n계정 자동 차단됨${ip ? `\nIP: ${ip}` : ""}`
    ).catch(console.error)
  } catch (err) {
    console.error("[log-view] anomaly detection error:", err)
  }
}
