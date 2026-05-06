import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { sendTelegramMessage } from "@/lib/telegram"

const SCENARIOS: Record<string, string> = {
  basic:    "✅ [관리자 테스트] Telegram 연동이 정상 작동 중입니다.",
  post:     "📝 [테스트] 새 게시글: \"택배 관련 문의\"\n👤 작성자: 홍길동\n🕐 방금 전",
  alert:    "🚨 [긴급 알림] 중요 검색어가 감지되었습니다!\n🔍 키워드: 긴급\n👤 사용자: user@example.com",
  building: "🏠 [테스트] 새 건물 등록\n건물명: DoorPass빌딩\n주소: 울산광역시 북구 신정동 123-4",
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const { scenario = "basic" } = (await request.json().catch(() => ({}))) as { scenario?: string }
    const message = SCENARIOS[scenario] ?? SCENARIOS.basic
    await sendTelegramMessage(message)
    return NextResponse.json({ ok: true, message: "Telegram으로 메시지가 전송됐습니다." })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "전송 실패" }, { status: 500 })
  }
}
