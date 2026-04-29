import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

export async function POST(request: Request) {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const body = (await request.json().catch(() => ({}))) as { branchId?: string }
    const branchId = String(body.branchId ?? "").trim()
    if (!branchId) {
      return NextResponse.json({ error: "branchId가 필요합니다." }, { status: 400 })
    }

    const { data: approved } = await supabaseAdmin
      .from("approved_users")
      .select("email")
      .eq("email", user!.email)
      .maybeSingle()
    if (approved) {
      return NextResponse.json({ message: "이미 승인된 사용자입니다.", status: "approved" })
    }

    const { data: existing } = await supabaseAdmin
      .from("pending_approvals")
      .select("id")
      .eq("user_email", user!.email)
      .eq("status", "pending")
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ message: "이미 승인 요청이 진행 중입니다." })
    }

    const { error } = await supabaseAdmin
      .from("pending_approvals")
      .insert({
        user_email: user!.email,
        user_name: user!.user_metadata?.name || user!.email,
        selected_branch_id: branchId,
      })
    if (error) throw error

    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("name")
      .eq("id", branchId)
      .maybeSingle()

    await sendTelegramMessage(
      `🔔 신규 회원 승인 요청\n\n📍 대리점: ${branch?.name ?? branchId}\n👤 이름: ${user!.user_metadata?.name || "미등록"}\n📧 이메일: ${user!.email}\n📅 요청일시: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}\n\n/admin/pending-approvals 에서 승인 처리하세요.`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Request Approval] 오류:", error)
    return NextResponse.json({ error: "승인 요청 실패" }, { status: 500 })
  }
}
