import { NextResponse } from "next/server"
import { Resend } from "resend"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

const resendClient = new Resend(process.env.RESEND_API_KEY)

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
    const selectedBranchId = String(body.branchId ?? "").trim()
    if (!selectedBranchId) {
      return NextResponse.json({ error: "branchId가 필요합니다." }, { status: 400 })
    }

    const userEmail = user!.email ?? ""

    const { data: approved } = await supabaseAdmin
      .from("approved_users")
      .select("email")
      .eq("email", userEmail)
      .maybeSingle()
    if (approved) {
      return NextResponse.json({ message: "이미 승인된 사용자입니다.", status: "approved" })
    }

    // 중복 승인 요청 허용: 매번 새 행을 insert
    // (기존 pending 체크 제거됨)

    // 약관 동의 기록 저장 (이미 존재해도 무시)
    await supabaseAdmin.from("terms_agreements").upsert(
      { user_email: userEmail, ip_address: ip, user_agent: userAgent, version: "v1.0" },
      { onConflict: "user_email", ignoreDuplicates: true }
    )

    const { data: inserted, error } = await supabaseAdmin
      .from("pending_approvals")
      .insert({
        user_email: userEmail,
        user_name: user!.user_metadata?.name || userEmail,
        selected_branch_id: selectedBranchId,
        status: "pending",
      })
      .select("id")
      .single()

    if (error) throw error
    const approvalId = Number(inserted?.id)
    if (!Number.isFinite(approvalId)) throw new Error("승인 요청 ID 생성 실패")

    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("name, manager_email")
      .eq("id", selectedBranchId)
      .maybeSingle()

    const branchName = (branch as { name?: string } | null)?.name ?? selectedBranchId

    // 1. 부관리자 먼저 찾기
    const { data: subAdmin } = await supabaseAdmin
      .from("approved_users")
      .select("email, name")
      .eq("branch_id", selectedBranchId)
      .eq("role", "sub_admin")
      .maybeSingle()

    // 2. 수신자 결정: 부관리자 → branches.manager_email → 관리자 → 최후 폴백
    let recipientEmail = (subAdmin as { email?: string } | null)?.email || ""

    if (!recipientEmail) {
      const managerEmail = (branch as { manager_email?: string } | null)?.manager_email
      if (managerEmail) {
        recipientEmail = managerEmail
      } else {
        const { data: adminUser } = await supabaseAdmin
          .from("approved_users")
          .select("email, name")
          .eq("role", "admin")
          .maybeSingle()
        recipientEmail =
          (adminUser as { email?: string } | null)?.email || "jazzcanon@gmail.com"
      }
    }

    console.log("=== 이메일 발송 시작 ===")
    console.log("RESEND_API_KEY 존재:", !!process.env.RESEND_API_KEY)
    console.log("RESEND_API_KEY 앞 10자:", process.env.RESEND_API_KEY?.substring(0, 10))
    console.log("수신자:", recipientEmail)

    // 4. 이메일 발송 (try-catch로 감싸기)
    try {
      const result = await resendClient.emails.send({
        from: "onboarding@resend.dev",
        to: [recipientEmail],
        subject: "[DoorPass] 새 회원 승인 요청",
        html: `
          <h2>새 회원 승인 요청이 있습니다</h2>
          <p>이메일: ${userEmail}</p>
          <p>대리점: ${selectedBranchId}</p>
          <p>요청 시각: ${new Date().toLocaleString("ko-KR")}</p>
          <br>
          <a href="https://doorpass.kr/admin/pending-approvals"
             style="background:#4CAF50;color:white;padding:10px 20px;
                    text-decoration:none;border-radius:5px;">
            승인하러 가기
          </a>
        `,
      })

      console.log("Resend 결과:", JSON.stringify(result))
    } catch (emailErr) {
      console.error("이메일 발송 예외:", emailErr)
    }

    // 5. Telegram 알림도 함께
    try {
      await sendTelegramMessage(
        `[DoorPass] 새 승인 요청\n이메일: ${userEmail}\n대리점: ${branchName} (${selectedBranchId})`
      )
    } catch (telegramError) {
      console.error("텔레그램 실패(무시):", telegramError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Request Approval] 오류:", error)
    return NextResponse.json({ error: "승인 요청 실패" }, { status: 500 })
  }
}
