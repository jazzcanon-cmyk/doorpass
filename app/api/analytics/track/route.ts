import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

const supabase = supabaseAdmin

const IMPORTANT_KEYWORDS = ["배송지연", "클레임", "긴급", "사고", "분실"]

export async function POST(request: Request) {
  try {
    const { type, data } = await request.json()
    if (!type) return NextResponse.json({ error: "type required" }, { status: 400 })

    const { error } = await supabase.from("user_activities").insert({
      action_type: type,
      target_type: data?.targetType ?? null,
      target_id:   data?.targetId   ?? null,
      metadata:    data ?? {},
    })

    if (error) {
      console.error("[Analytics] DB insert error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 중요 검색어 감지 시 Slack 알림 (fire-and-forget)
    if (type === "search" && data?.query) {
      const query = String(data.query)
      const matched = IMPORTANT_KEYWORDS.find((kw) => query.includes(kw))
      if (matched) {
        sendTelegramMessage(
          `⚠️ 중요 검색어 감지\n검색어: ${query}\n검색자: ${data.userEmail || "알 수 없음"}\n결과: ${data.results ?? 0}개`
        ).catch((err) => console.error("[Telegram] 검색어 알림 전송 실패:", err))
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Analytics] track error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
