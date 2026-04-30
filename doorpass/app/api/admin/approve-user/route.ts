import { NextResponse } from "next/server"
import { requireManagerApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { executePendingApprovalById } from "@/lib/pending-approval-actions"
import { sendApprovalResultEmail } from "@/lib/email"

export async function POST(request: Request) {
  const { user, role, unauthorized } = await requireManagerApi()
  if (unauthorized) return unauthorized

  try {
    const body = (await request.json().catch(() => ({}))) as {
      approvalId?: number
      action?: "approve" | "reject"
    }
    const approvalId = Number(body.approvalId)
    const action = body.action

    if (!Number.isFinite(approvalId) || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ error: "요청 값이 올바르지 않습니다." }, { status: 400 })
    }

    const { data: currentUser } = await supabaseAdmin
      .from("approved_users")
      .select("branch_id")
      .eq("email", user!.email)
      .maybeSingle()

    const { data: approval } = await supabaseAdmin
      .from("pending_approvals")
      .select("*")
      .eq("id", approvalId)
      .maybeSingle()

    if (!approval) {
      return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 })
    }
    if (approval.status !== "pending") {
      return NextResponse.json({ error: "이미 처리된 요청입니다." }, { status: 400 })
    }

    if (role === "sub_admin" && approval.selected_branch_id !== currentUser?.branch_id) {
      return NextResponse.json({ error: "다른 대리점 회원은 처리할 수 없습니다." }, { status: 403 })
    }

    const result = await executePendingApprovalById(approvalId, action, user!.email ?? "unknown")
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.httpStatus })
    }

    const row = result.approval

    await sendTelegramMessage(
      action === "approve"
        ? `✅ 회원 승인 완료\n📧 이메일: ${row.user_email}\n👤 이름: ${row.user_name}\n👔 승인자: ${user!.email}\n📅 승인일시: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
        : `❌ 회원 승인 거부\n📧 이메일: ${row.user_email}\n👤 이름: ${row.user_name}\n👔 처리자: ${user!.email}`
    ).catch(console.error)

    await sendApprovalResultEmail({
      toEmail: row.user_email,
      approved: action === "approve",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Approve User] 오류:", error)
    return NextResponse.json({ error: "처리 실패" }, { status: 500 })
  }
}
