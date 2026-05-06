import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { executePendingApprovalById } from "@/lib/pending-approval-actions"
import { sendTelegramMessage } from "@/lib/telegram"
import { sendApprovalResultEmail } from "@/lib/email"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function resultRedirect(request: Request, status: string): NextResponse {
  const base = new URL(request.url)
  base.pathname = "/approval-result"
  base.search = ""
  base.searchParams.set("status", status)
  return NextResponse.redirect(base, { status: 303 })
}

/** 이메일 링크용 승인 처리 (GET, 로그인 불필요). */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token") ?? ""

  if (!token || !UUID_RE.test(token)) {
    return resultRedirect(request, "invalid")
  }

  try {
    const { data: row, error: qErr } = await supabaseAdmin
      .from("pending_approvals")
      .select("id, status, created_at")
      .eq("token", token)
      .maybeSingle()

    if (qErr) throw qErr
    if (!row) return resultRedirect(request, "invalid")
    if (row.status !== "pending") return resultRedirect(request, "already")

    const createdAt = new Date(row.created_at)
    const now = new Date()
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
    if (hoursDiff > 72) {
      return resultRedirect(request, "expired")
    }

    const result = await executePendingApprovalById(Number(row.id), "approve", "email-link")

    if (!result.ok) {
      if (result.httpStatus === 400) return resultRedirect(request, "already")
      return resultRedirect(request, "error")
    }

    const { approval } = result

    sendApprovalResultEmail({ toEmail: approval.user_email, approved: true }).catch(console.error)

    sendTelegramMessage(
      `✅ 회원 승인 완료 (이메일 링크)\n📧 이메일: ${approval.user_email}\n👤 이름: ${approval.user_name ?? "-"}\n📅 처리: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
    ).catch(console.error)

    return resultRedirect(request, "approved")
  } catch (e) {
    console.error("[approve] 처리 실패:", (e as Error).message)
    return resultRedirect(request, "error")
  }
}
