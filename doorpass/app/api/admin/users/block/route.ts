import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

export async function POST(request: Request) {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const body = (await request.json().catch(() => ({}))) as { userEmail?: string }
    const userEmail = String(body.userEmail ?? "").trim().toLowerCase()
    if (!userEmail) {
      return NextResponse.json({ error: "userEmail이 필요합니다" }, { status: 400 })
    }

    const { data: currentUser } = await supabaseAdmin
      .from("approved_users")
      .select("role, branch_id")
      .eq("email", user?.email ?? "unknown")
      .maybeSingle()

    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "sub_admin")) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 })
    }

    const { data: targetUser } = await supabaseAdmin
      .from("approved_users")
      .select("email, name, role, branch_id, branches(name)")
      .eq("email", userEmail)
      .maybeSingle()

    if (!targetUser) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 })
    }

    if (currentUser.role === "sub_admin" && targetUser.branch_id !== currentUser.branch_id) {
      return NextResponse.json({ error: "다른 대리점 회원은 차단할 수 없습니다" }, { status: 403 })
    }

    if (userEmail === (user?.email ?? "unknown")) {
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
      `🚫 회원 차단\n\n📧 대상: ${targetUser.name || userEmail}\n🏢 대리점: ${(targetUser.branches as { name?: string } | null)?.name || "미지정"}\n👤 차단자: ${user?.email ?? "unknown"}\n📅 시간: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}\n\n⚠️ 차단된 회원은 로그인할 수 없습니다.`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/users:block] 차단 실패:", (error as Error).message)
    return NextResponse.json({ error: "차단 실패" }, { status: 500 })
  }
}
