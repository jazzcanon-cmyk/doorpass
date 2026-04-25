import { NextResponse } from "next/server"
import { sendSlackMessage } from "@/lib/slack"

export async function GET() {
  const result = await sendSlackMessage({
    text: "✅ DoorPass Slack 연동 테스트 메시지입니다.",
    color: "#0070f3",
    fields: [
      { title: "상태", value: "연동 정상" },
      { title: "시간", value: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) },
    ],
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true, message: "Slack 테스트 메시지 전송 완료" })
}

export async function POST() {
  return GET()
}
