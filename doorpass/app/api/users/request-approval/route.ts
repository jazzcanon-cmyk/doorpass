import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { sendApprovalRequestEmail } from "@/lib/email"

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

    const linkToken = randomUUID()

    const { data: inserted, error } = await supabaseAdmin
      .from("pending_approvals")
      .insert({
        user_email: user!.email,
        user_name: user!.user_metadata?.name || user!.email,
        selected_branch_id: branchId,
        token: linkToken,
      })
      .select("id")
      .single()

    if (error) throw error
    const approvalId = Number(inserted?.id)
    if (!Number.isFinite(approvalId)) throw new Error("승인 요청 ID 생성 실패")

    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("name")
      .eq("id", branchId)
      .maybeSingle()

    const branchName = branch?.name ?? branchId

    const { data: subAdmins } = await supabaseAdmin
      .from("approved_users")
      .select("email, is_active, is_blocked")
      .eq("branch_id", branchId)
      .eq("role", "sub_admin")

    const toEmails = (subAdmins ?? [])
      .filter((r) => {
        const row = r as { email?: string; is_active?: boolean | null; is_blocked?: boolean | null }
        if (row.is_blocked === true) return false
        if (row.is_active === false) return false
        return true
      })
      .map((r) => (r as { email?: string }).email)
      .filter((e): e is string => typeof e === "string" && e.includes("@"))

    const requestedAtLabel = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    const requesterName = String(user!.user_metadata?.name || user!.email || "미등록")

    await sendTelegramMessage(
      `🔔 신규 회원 승인 요청\n\n📍 대리점: ${branchName}\n👤 이름: ${requesterName}\n📧 이메일: ${user!.email}\n📅 요청일시: ${requestedAtLabel}\n\n/admin/pending-approvals 에서 승인 처리하세요.`
    )

    await sendApprovalRequestEmail({
      toEmails,
      branchName,
      requesterName,
      requesterEmail: user!.email ?? "",
      requestedAtLabel,
      token: linkToken,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Request Approval] 오류:", error)
    return NextResponse.json({ error: "승인 요청 실패" }, { status: 500 })
  }
}
