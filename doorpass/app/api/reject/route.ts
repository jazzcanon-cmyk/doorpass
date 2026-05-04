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

/** 이메일 링크용 거절 처리 (GET, 로그인 불필요). */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token") ?? ""

  if (!token || !UUID_RE.test(token)) {
    return resultRedirect(request, "invalid")
  }

  try {
    const { data: row, error: qErr } = await supabaseAdmin
      .from("pending_approvals")
      .select("id, status")
      .eq("token", token)
      .maybeSingle()

    if (qErr) throw qErr
    if (!row) return resultRedirect(request, "invalid")
    if (row.status !== "pending") return resultRedirect(request, "already")

    const result = await executePendingApprovalById(Number(row.id), "reject", "email-link")

    if (!result.ok) {
      if (result.httpStatus === 400) return resultRedirect(request, "already")
      return resultRedirect(request, "error")
    }

    const { approval } = result

    sendApprovalResultEmail({ toEmail: approval.user_email, approved: false }).catch(console.error)

    sendTelegramMessage(
      `❌ 회원 승인 거부 (이메일 링크)\n📧 이메일: ${approval.user_email}\n👤 이름: ${approval.user_name ?? "-"}`
    ).catch(console.error)

    return resultRedirect(request, "rejected")
  } catch (e) {
    console.error("[GET /api/reject]", e)
    return resultRedirect(request, "error")
  }
}
