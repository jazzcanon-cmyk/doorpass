import { NextResponse } from "next/server"
import { requireManagerApi, resolveUserEmail } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

export async function POST(request: Request) {
  const { user, role, unauthorized } = await requireManagerApi()
  if (unauthorized) return unauthorized

  try {
    const body = (await request.json().catch(() => ({}))) as { userEmail?: string }
    const userEmail = String(body.userEmail ?? "").trim().toLowerCase()
    if (!userEmail) {
      return NextResponse.json({ error: "userEmail이 필요합니다" }, { status: 400 })
    }

    // sub_admin: 자신의 대리점 branch_id 조회
    let myBranchId: string | null = null
    if (role === "sub_admin" && user) {
      const { data: me } = await supabaseAdmin
        .from("approved_users")
        .select("branch_id")
        .eq("email", resolveUserEmail(user!))
        .maybeSingle()
      myBranchId = me?.branch_id ?? null
    }

    const { data: targetUser } = await supabaseAdmin
      .from("approved_users")
      .select("email, name, role, branch_id, branches(name)")
      .eq("email", userEmail)
      .maybeSingle()

    if (!targetUser) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 })
    }

    if (role === "sub_admin" && targetUser.branch_id !== myBranchId) {
      return NextResponse.json({ error: "다른 대리점 회원은 차단할 수 없습니다" }, { status: 403 })
    }

    if (user && userEmail === resolveUserEmail(user)) {
      return NextResponse.json({ error: "자기 자신은 차단할 수 없습니다" }, { status: 400 })
    }

    if (targetUser.role === "admin" || targetUser.role === "sub_admin") {
      return NextResponse.json({ error: "관리자 또는 부관리자는 차단할 수 없습니다" }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from("approved_users")
      .delete()
      .eq("email", userEmail)
    if (error) throw error

    await sendTelegramMessage(
      `🚫 회원 차단\n\n📧 대상: ${targetUser.name || userEmail}\n🏢 대리점: ${(targetUser.branches as { name?: string } | null)?.name || "미지정"}\n👤 차단자: ${resolveUserEmail(user!)}\n📅 시간: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}\n\n⚠️ 차단된 회원은 로그인할 수 없습니다.`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/users:block] 차단 실패:", (error as Error).message)
    return NextResponse.json({ error: "차단 실패" }, { status: 500 })
  }
}
