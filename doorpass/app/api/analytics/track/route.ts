import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendSlackMessage } from "@/lib/slack"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
        sendSlackMessage({
          text: "⚠️ 중요 검색어 감지",
          color: "#ff0000",
          fields: [
            { title: "검색어", value: query, short: false },
            { title: "검색자", value: data.userEmail || "알 수 없음" },
            { title: "결과", value: `${data.results ?? 0}개` },
          ],
        }).catch((err) => console.error("[Slack] 검색어 알림 전송 실패:", err))
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Analytics] track error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
