import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

const ALLOWED_ROLES = new Set(["admin", "sub_admin", "editor", "driver"])

export async function PUT(request: Request) {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const body = (await request.json().catch(() => ({}))) as { userEmail?: string; newRole?: string }
    const userEmail = String(body.userEmail ?? "").trim().toLowerCase()
    const newRole = String(body.newRole ?? "").trim()

    if (!userEmail || !ALLOWED_ROLES.has(newRole)) {
      return NextResponse.json({ error: "요청 값이 올바르지 않습니다." }, { status: 400 })
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
      return NextResponse.json({ error: "다른 대리점 회원의 역할은 변경할 수 없습니다" }, { status: 403 })
    }

    if (currentUser.role === "sub_admin" && (newRole === "admin" || newRole === "sub_admin")) {
      return NextResponse.json({ error: "관리자 또는 부관리자로 승격할 권한이 없습니다" }, { status: 403 })
    }

    let updateError: { message?: string } | null = null
    const attemptWithUpdatedAt = await supabaseAdmin
      .from("approved_users")
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq("email", userEmail)
    if (attemptWithUpdatedAt.error) {
      if (/updated_at/i.test(attemptWithUpdatedAt.error.message || "")) {
        const fallback = await supabaseAdmin.from("approved_users").update({ role: newRole }).eq("email", userEmail)
        updateError = fallback.error
      } else {
        updateError = attemptWithUpdatedAt.error
      }
    }
    if (updateError) throw updateError

    const roleLabels: Record<string, string> = {
      admin: "관리자",
      sub_admin: "부관리자",
      editor: "편집자",
      driver: "기사",
    }

    await sendTelegramMessage(
      `🔄 회원 역할 변경\n\n📧 대상: ${targetUser.name || userEmail}\n🏢 대리점: ${(targetUser.branches as { name?: string } | null)?.name || "미지정"}\n📊 변경: ${roleLabels[targetUser.role] || targetUser.role} → ${roleLabels[newRole] || newRole}\n👤 변경자: ${user?.email ?? "unknown"}\n📅 시간: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Role Change] 오류:", error)
    return NextResponse.json({ error: "역할 변경 실패" }, { status: 500 })
  }
}
