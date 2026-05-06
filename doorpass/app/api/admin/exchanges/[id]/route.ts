import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendPushToUser } from "@/lib/push"
import { sendTelegramMessage } from "@/lib/telegram"

interface ProcessRpcResult {
  success: boolean
  reason?: string
  id?: number
  status?: "completed" | "rejected"
  user_email?: string
  refunded?: number
  new_total?: number
}

interface ExchangeContext {
  user_name: string | null
  reward_name: string
  points_used: number
}

// 관리자 — 교환 신청 처리 (지급 완료 / 반려)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "잘못된 id" }, { status: 400 })
  }

  let body: { action?: string; memo?: string } = {}
  try {
    body = (await request.json()) as { action?: string; memo?: string }
  } catch {}

  const action = body.action
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action은 approve 또는 reject" }, { status: 400 })
  }
  const memo = body.memo?.trim() || null

  // 알림 메시지 구성용 컨텍스트 (RPC 호출 전 미리 조회)
  const { data: ctxData } = await supabaseAdmin
    .from("point_exchanges")
    .select("user_name, reward_name, points_used")
    .eq("id", id)
    .maybeSingle()
  const ctx = (ctxData ?? null) as ExchangeContext | null

  const adminEmail = user?.email ?? "unknown"

  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    "process_point_exchange",
    {
      p_id: id,
      p_action: action,
      p_admin: adminEmail,
      p_memo: memo,
    }
  )

  if (rpcError) {
    console.error("[admin/exchanges process] RPC 오류", rpcError)
    return NextResponse.json({ error: "처리 중 오류" }, { status: 500 })
  }

  const result = rpcData as ProcessRpcResult
  if (!result.success) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 })
    }
    if (result.reason === "already_processed") {
      return NextResponse.json({ error: "이미 처리된 신청입니다." }, { status: 409 })
    }
    return NextResponse.json({ error: "처리 실패" }, { status: 400 })
  }

  const targetEmail = result.user_email ?? ""
  const rewardName = ctx?.reward_name ?? "GS상품권 1만원"

  if (action === "approve") {
    if (targetEmail) {
      void sendPushToUser(targetEmail, {
        title: "🎉 상품권 지급 완료",
        body: `${rewardName} 지급이 완료되었습니다!`,
        url: "/my-points",
      }).catch(console.error)
    }
    void sendTelegramMessage(
      `✅ 교환 처리 완료\n회원: ${ctx?.user_name ?? targetEmail}\n상품: ${rewardName}\n처리자: ${adminEmail}`,
      "new_user_notification"
    ).catch(console.error)
  } else {
    if (targetEmail) {
      void sendPushToUser(targetEmail, {
        title: "상품권 교환이 반려되었습니다",
        body: `포인트 ${ctx?.points_used?.toLocaleString() ?? ""}P가 환불되었습니다.${memo ? ` (${memo})` : ""}`,
        url: "/my-points",
      }).catch(console.error)
    }
    void sendTelegramMessage(
      `❌ 교환 반려\n회원: ${ctx?.user_name ?? targetEmail}\n환불: ${result.refunded ?? 0}P${memo ? `\n사유: ${memo}` : ""}`,
      "new_user_notification"
    ).catch(console.error)
  }

  return NextResponse.json({
    success: true,
    id: result.id,
    status: result.status,
    refunded: result.refunded ?? 0,
    newTotal: result.new_total ?? null,
  })
}
