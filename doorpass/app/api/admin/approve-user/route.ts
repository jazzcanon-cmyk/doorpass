import { NextResponse } from "next/server"
import { requireManagerApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { executePendingApprovalById } from "@/lib/pending-approval-actions"
import { sendAlimtalk } from "@/lib/solapi"

export async function POST(request: Request) {
  const { user, role, unauthorized } = await requireManagerApi()
  if (unauthorized) return unauthorized

  try {
    const body = (await request.json().catch(() => ({}))) as {
      approvalId?: number
      action?: "approve" | "reject"
      role?: "driver" | "editor"
      branch_id_override?: string | null
    }
    const approvalId = Number(body.approvalId)
    const action = body.action
    const assignedRole = body.role === "editor" ? "editor" : "driver"
    const branchIdOverride = body.branch_id_override !== undefined
      ? (body.branch_id_override || null)
      : undefined

    if (!Number.isFinite(approvalId) || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ error: "요청 값이 올바르지 않습니다." }, { status: 400 })
    }

    const email = user?.email ?? "unknown"
    const meta = user?.user_metadata as Record<string, unknown> | undefined
    const userId =
      ((meta?.provider_id as string | undefined) ??
        (meta?.sub as string | undefined) ??
        (user?.id ?? "")) as string

    let currentUser: { branch_id: string | null } | null = null
    if (email) {
      const { data } = await supabaseAdmin
        .from("approved_users")
        .select("branch_id")
        .eq("email", email)
        .maybeSingle()
      currentUser = data
    }
    if (!currentUser) {
      const { data } = await supabaseAdmin
        .from("approved_users")
        .select("branch_id")
        .eq("kakao_id", userId)
        .maybeSingle()
      currentUser = data
    }

    if (role === "sub_admin") {
      const { data: approval } = await supabaseAdmin
        .from("pending_approvals")
        .select("selected_branch_id")
        .eq("id", approvalId)
        .maybeSingle()

      if (!approval) {
        return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 })
      }
      if (approval.selected_branch_id !== currentUser?.branch_id) {
        return NextResponse.json({ error: "다른 대리점 회원은 처리할 수 없습니다." }, { status: 403 })
      }
    }

    const result = await executePendingApprovalById(approvalId, action, user?.email ?? "unknown", assignedRole, branchIdOverride)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.httpStatus })
    }

    const row = result.approval

    await sendTelegramMessage(
      action === "approve"
        ? `✅ 회원 승인 완료\n📧 이메일: ${row.user_email}\n👤 이름: ${row.user_name}\n👔 승인자: ${user?.email ?? "unknown"}\n📅 승인일시: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
        : `❌ 회원 승인 거부\n📧 이메일: ${row.user_email}\n👤 이름: ${row.user_name}\n👔 처리자: ${user?.email ?? "unknown"}`
    ).catch(console.error)

    // 신규 회원에게 승인 완료 PWA 푸시 알림
    if (action === "approve" && row.user_email) {
      const internalSecret = process.env.INTERNAL_API_SECRET
      if (!internalSecret || internalSecret.length < 16) {
        console.warn("[approve-user] INTERNAL_API_SECRET 미설정/짧음 - 푸시 알림 스킵")
      } else {
        fetch(new URL("/api/push/send", request.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-secret": internalSecret },
          body: JSON.stringify({
            userEmail: row.user_email,
            title: "✅ 승인이 완료됐어요!",
            body: "이제 건물 비밀번호를 확인할 수 있어요. 앱을 다시 열어주세요!",
            url: "/",
          }),
        }).catch(console.error)
      }
    }

    if (action === "approve") {
      try {
        const { data: referralToken } = await supabaseAdmin
          .from('referral_tokens')
          .update({ status: 'used', used_at: new Date().toISOString() })
          .eq('referred_email', row.user_email)
          .eq('status', 'pending')
          .select('id, token, referrer_email')
          .maybeSingle()

        if (referralToken) {
          const { addPoints } = await import('@/lib/points')
          await addPoints({
            email: referralToken.referrer_email,
            action: 'referral_send',
            buildingName: '추천인 보상',
          })
          await addPoints({
            email: row.user_email,
            action: 'referral_receive',
            buildingName: '추천 가입 보너스',
          })

          sendTelegramMessage(
            '[DoorPass] 🎉 추천 가입 완료!\n추천인: ' + referralToken.referrer_email + ' (+500P)\n신규: ' + row.user_email + ' (+300P)',
            'new_user_notification'
          ).catch(console.error)
        }
      } catch (e) {
        console.error('[approve-user/referral]', (e as Error).message)
      }
    }

    if (action === "approve" && row.phone) {
      let branchName = "대리점"
      if (row.selected_branch_id) {
        const { data: branch } = await supabaseAdmin
          .from("branches")
          .select("name")
          .eq("id", row.selected_branch_id)
          .maybeSingle()
        if (branch) branchName = (branch as { name: string }).name
      }
      const roleLabels: Record<string, string> = { driver: "기사", editor: "편집자", sub_admin: "부관리자", admin: "관리자" }
      sendAlimtalk(row.phone, "IEPVbU3DRb", {
        "#{이름}": row.user_name ?? "회원",
        "#{대리점명}": branchName,
        "#{역할}": roleLabels[assignedRole] ?? assignedRole,
      }).catch(console.error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[approve-user] 처리 실패:", (error as Error).message)
    return NextResponse.json({ error: "처리 실패" }, { status: 500 })
  }
}
