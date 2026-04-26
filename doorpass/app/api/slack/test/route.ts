import { NextResponse } from "next/server"
import { sendSlackMessage, SlackMessageOptions } from "@/lib/slack"
import { requireAdminApi } from "@/lib/auth"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase-route"

const now = () => new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })

const SCENARIOS: Record<string, SlackMessageOptions> = {
  basic: {
    text: "✅ DoorPass Slack 연동 테스트",
    color: "#0070f3",
    fields: [
      { title: "상태", value: "연동 정상" },
      { title: "시간", value: now() },
    ],
  },
  post: {
    text: "📝 [신정대리점] 새 게시글",
    color: "#36a64f",
    fields: [
      { title: "제목", value: "테스트 게시글입니다", short: false },
      { title: "작성자", value: "홍길동" },
      { title: "카테고리", value: "일반" },
      { title: "링크", value: "https://doorpass.kr", short: false },
    ],
  },
  alert: {
    text: "⚠️ 중요 검색어 감지",
    color: "#ff0000",
    fields: [
      { title: "검색어", value: "긴급", short: false },
      { title: "검색자", value: "test@example.com" },
      { title: "결과", value: "3개" },
    ],
  },
  building: {
    text: "🏠 새로운 건물이 등록되었습니다!",
    color: "#36a64f",
    fields: [
      { title: "건물명", value: "테스트빌딩" },
      { title: "주소", value: "울산시 북구 테스트로 123", short: false },
    ],
  },
}

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const scenario = (searchParams.get("scenario") ?? "basic") as keyof typeof SCENARIOS
  const msg = SCENARIOS[scenario] ?? SCENARIOS.basic

  const result = await sendSlackMessage(msg)

  const supabase = await createSupabaseRouteHandlerClient()
  await supabase.from("user_activities").insert({
    action_type: "slack_test",
    metadata: { scenario, ok: result.ok, error: result.error ?? null },
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, scenario, error: result.error }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    scenario,
    message: `Slack 테스트 전송 완료 (scenario: ${scenario})`,
    available: Object.keys(SCENARIOS),
  })
}

export async function POST(request: Request) {
  return GET(request)
}
