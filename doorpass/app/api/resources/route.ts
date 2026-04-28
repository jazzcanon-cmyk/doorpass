import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { requireAuth } from "@/lib/auth"
import { logActivity, getIp } from "@/lib/activity-logger"

const supabase = supabaseAdmin

export async function GET(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) throw new Error(error.message)
    logActivity(user!.email!, "resource_view", { count: data?.length ?? 0 }, getIp(request))
    return NextResponse.json({ resources: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "자료를 불러오지 못했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const body = await request.json()
    const { action, ...payload } = body as { action?: string; [key: string]: unknown }

    if (action === "delete") {
      const { error } = await supabase.from("resources").delete().eq("id", payload.id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true })
    }

    const { title, resource_type, author } = payload as { title?: string; resource_type?: string; author?: string }
    const { error } = await supabase.from("resources").insert(payload)
    if (error) throw new Error(error.message)

    const TYPE_LABELS: Record<string, string> = { link: "링크", file: "파일", image: "이미지", document: "문서", text: "글" }
    sendTelegramMessage(
      `📁 [신정대리점] 새 자료 등록: ${title ?? "-"}\n유형: ${TYPE_LABELS[resource_type ?? ""] ?? (resource_type ?? "-")}\n등록자: ${author ?? "관리자"}\n시간: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
    ).catch((err) => console.error("[Telegram] 자료실 알림 전송 실패:", err))

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "처리에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
