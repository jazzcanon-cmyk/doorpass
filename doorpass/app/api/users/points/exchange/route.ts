import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

const RECEIVE_METHODS = ["visit", "mobile"] as const
type ReceiveMethod = (typeof RECEIVE_METHODS)[number]

const RECEIVE_LABEL: Record<ReceiveMethod, string> = {
  visit: "사무실 방문",
  mobile: "모바일 상품권 (카카오)",
}

interface ExchangeRow {
  id: number
  user_email: string
  user_name: string | null
  points_used: number
  reward_type: string
  reward_name: string
  receive_method: ReceiveMethod
  status: "pending" | "completed" | "rejected"
  admin_memo: string | null
  requested_at: string
  processed_at: string | null
  processed_by: string | null
}

// ─── POST: 교환 신청 ────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const email = user!.email
  if (!email) {
    return NextResponse.json({ error: "이메일 정보를 찾을 수 없습니다." }, { status: 400 })
  }

  let body: { receiveMethod?: string } = {}
  try {
    body = (await request.json()) as { receiveMethod?: string }
  } catch {
    // 빈 body 허용 → 기본값 visit
  }
  const method = (body.receiveMethod ?? "visit") as ReceiveMethod
  if (!RECEIVE_METHODS.includes(method)) {
    return NextResponse.json({ error: "잘못된 수령 방법입니다." }, { status: 400 })
  }

  // 표시용 이름 조회 (approved_users → fallback: 메타데이터 → 이메일 prefix)
  const { data: approved } = await supabaseAdmin
    .from("approved_users")
    .select("name")
    .eq("email", email)
    .maybeSingle()
  const userName: string =
    (approved?.name as string | undefined) ??
    (user!.user_metadata?.name as string | undefined) ??
    (user!.user_metadata?.full_name as string | undefined) ??
    email.split("@")[0]

  // 원자적 처리: pending 중복 / 잔액 / 차감 / 로그 / 행 생성
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    "request_point_exchange",
    {
      p_email: email,
      p_name: userName,
      p_method: method,
    }
  )

  if (rpcError) {
    console.error("[exchange] RPC 오류", rpcError)
    return NextResponse.json({ error: "교환 처리 중 오류가 발생했습니다." }, { status: 500 })
  }

  const result = rpcData as {
    success: boolean
    reason?: string
    id?: number
    points_used?: number
    remaining?: number
    current?: number
  }

  if (!result.success) {
    if (result.reason === "pending_exists") {
      return NextResponse.json(
        { error: "이미 처리 중인 교환 신청이 있습니다." },
        { status: 409 }
      )
    }
    if (result.reason === "insufficient") {
      return NextResponse.json(
        { error: `포인트가 부족합니다. (현재: ${result.current ?? 0}P)` },
        { status: 400 }
      )
    }
    if (result.reason === "no_points_row") {
      return NextResponse.json({ error: "포인트 정보가 없습니다." }, { status: 400 })
    }
    return NextResponse.json({ error: "교환 처리 실패" }, { status: 400 })
  }

  // 관리자 텔레그램 알림 (실패해도 응답에 영향 없음)
  void sendTelegramMessage(
    [
      "🎁 상품권 교환 신청",
      `회원: ${userName}`,
      `이메일: ${email}`,
      `상품: GS상품권 1만원`,
      `수령: ${RECEIVE_LABEL[method]}`,
      `차감: 10,000P`,
      `잔여: ${(result.remaining ?? 0).toLocaleString()}P`,
    ].join("\n"),
    "new_user_notification"
  ).catch(console.error)

  return NextResponse.json({
    success: true,
    id: result.id,
    pointsUsed: result.points_used ?? 10000,
    remainingPoints: result.remaining ?? 0,
  })
}

// ─── GET: 내 교환 이력 ──────────────────────────────────────────────────────
export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const email = user!.email
  if (!email) return NextResponse.json({ exchanges: [] })

  const { data, error } = await supabaseAdmin
    .from("point_exchanges")
    .select(
      "id, user_email, user_name, points_used, reward_type, reward_name, receive_method, status, admin_memo, requested_at, processed_at, processed_by"
    )
    .eq("user_email", email)
    .order("requested_at", { ascending: false })
    .limit(20)

  if (error) {
    console.error("[exchange GET] 조회 실패", error)
    return NextResponse.json({ exchanges: [] })
  }

  return NextResponse.json({ exchanges: (data ?? []) as ExchangeRow[] })
}
