import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { sendApprovalRequestEmail } from "@/lib/email"

export async function POST(request: Request) {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  const userAgent = request.headers.get("user-agent") ?? null

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
      return NextResponse.json({ success: true })
    }

    // 약관 동의 기록 저장 (이미 존재해도 무시)
    await supabaseAdmin.from("terms_agreements").upsert(
      { user_email: user!.email, ip_address: ip, user_agent: userAgent, version: "v1.0" },
      { onConflict: "user_email", ignoreDuplicates: true }
    )

    const { data: inserted, error } = await supabaseAdmin
      .from("pending_approvals")
      .insert({
        user_email: user!.email,
        user_name: user!.user_metadata?.name || user!.email,
        selected_branch_id: branchId,
        status: "pending",
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

    // 1) 해당 지점의 부관리자 조회
    const { data: subAdmins } = await supabaseAdmin
      .from("approved_users")
      .select("email, name, is_active, is_blocked")
      .eq("branch_id", branchId)
      .eq("role", "sub_admin")

    const subAdminEmails = (subAdmins ?? [])
      .filter((r) => {
        const row = r as { is_active?: boolean | null; is_blocked?: boolean | null }
        if (row.is_blocked === true) return false
        if (row.is_active === false) return false
        return true
      })
      .map((r) => (r as { email?: string }).email)
      .filter((e): e is string => typeof e === "string" && e.includes("@"))

    // 2) 부관리자 없으면 관리자(admin)에게 폴백
    let toEmails: string[] = subAdminEmails
    if (toEmails.length === 0) {
      const { data: admins } = await supabaseAdmin
        .from("approved_users")
        .select("email, is_active, is_blocked")
        .eq("role", "admin")

      const adminEmails = (admins ?? [])
        .filter((r) => {
          const row = r as { is_active?: boolean | null; is_blocked?: boolean | null }
          if (row.is_blocked === true) return false
          if (row.is_active === false) return false
          return true
        })
        .map((r) => (r as { email?: string }).email)
        .filter((e): e is string => typeof e === "string" && e.includes("@"))

      toEmails = adminEmails
    }

    // 3) 그래도 없으면 최후 폴백
    if (toEmails.length === 0) {
      toEmails = ["jazzcanon@gmail.com"]
    }

    console.log("이메일 발송 대상:", toEmails)

    const requestedAtLabel = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    const requesterName = String(user!.user_metadata?.name || user!.email || "미등록")

    // 5) Telegram 알림 (이메일 실패 대비 이중 알림)
    try {
      await sendTelegramMessage(
        `🔔 신규 회원 승인 요청\n\n📍 대리점: ${branchName}\n👤 이름: ${requesterName}\n📧 이메일: ${user!.email}\n📅 요청일시: ${requestedAtLabel}\n📨 수신자: ${toEmails.join(", ")}\n\n/admin/pending-approvals 에서 승인 처리하세요.`
      )
    } catch (telegramError) {
      console.error("텔레그램 실패(무시):", telegramError)
    }

    try {
      await sendApprovalRequestEmail({
        toEmails,
        branchName,
        requesterName,
        requesterEmail: user!.email ?? "",
        requestedAtLabel,
        token: randomUUID(),
      })
    } catch (emailError) {
      console.error("이메일 실패(무시):", emailError)
      // 이메일 실패해도 계속 진행!
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Request Approval] 오류:", error)
    return NextResponse.json({ error: "승인 요청 실패" }, { status: 500 })
  }
}
