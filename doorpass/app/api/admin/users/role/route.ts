import { NextResponse } from "next/server"
import { requireManagerApi, resolveUserEmail } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { sendAlimtalk } from "@/lib/solapi"

const ALLOWED_ROLES = new Set(["admin", "sub_admin", "editor", "driver"])

export async function PUT(request: Request) {
  const { user, role, unauthorized } = await requireManagerApi()
  if (unauthorized) return unauthorized

  try {
    const body = (await request.json().catch(() => ({}))) as { userEmail?: string; newRole?: string }
    const userEmail = String(body.userEmail ?? "").trim().toLowerCase()
    const newRole = String(body.newRole ?? "").trim()

    if (!userEmail || !ALLOWED_ROLES.has(newRole)) {
      return NextResponse.json({ error: "요청 값이 올바르지 않습니다." }, { status: 400 })
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
      .select("email, name, role, branch_id, phone, branches(name)")
      .eq("email", userEmail)
      .maybeSingle()

    if (!targetUser) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 })
    }

    if (role === "sub_admin" && targetUser.branch_id !== myBranchId) {
      return NextResponse.json({ error: "다른 대리점 회원의 역할은 변경할 수 없습니다" }, { status: 403 })
    }

    if (role === "sub_admin" && (newRole === "admin" || newRole === "sub_admin")) {
      return NextResponse.json({ error: "관리자 또는 부관리자로 승격할 권한이 없습니다" }, { status: 403 })
    }

    const tryUpdate = async (includeUpdatedAt: boolean) => {
      const patch: { role: string; updated_at?: string } = { role: newRole }
      if (includeUpdatedAt) patch.updated_at = new Date().toISOString()
      return await supabaseAdmin
        .from("approved_users")
        .update(patch)
        .eq("email", userEmail)
        .neq("role", newRole)
        .select("id")
        .maybeSingle()
    }

    let result = await tryUpdate(true)
    if (result.error && /updated_at/i.test(result.error.message || "")) {
      result = await tryUpdate(false)
    }
    if (result.error) throw result.error
    if (!result.data) {
      return NextResponse.json(
        { error: "이미 같은 역할로 변경되었습니다. 화면을 새로고침해주세요." },
        { status: 409 }
      )
    }

    const roleLabels: Record<string, string> = {
      admin: "관리자",
      sub_admin: "부관리자",
      editor: "편집자",
      driver: "기사",
    }

    await sendTelegramMessage(
      `🔄 회원 역할 변경\n\n📧 대상: ${targetUser.name || userEmail}\n🏢 대리점: ${(targetUser.branches as { name?: string } | null)?.name || "미지정"}\n📊 변경: ${roleLabels[targetUser.role] || targetUser.role} → ${roleLabels[newRole] || newRole}\n👤 변경자: ${resolveUserEmail(user!)}\n📅 시간: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
    )

    if (newRole === "editor" || newRole === "sub_admin") {
      const templateId = newRole === "editor" ? "yTAHO9kIH6" : "GSBxO0jg2H"
      const branchName = (targetUser.branches as { name?: string } | null)?.name ?? "대리점"
      const phone = (targetUser as { phone?: string | null }).phone
      sendAlimtalk(phone, templateId, {
        "#{이름}": targetUser.name || userEmail,
        "#{대리점명}": branchName,
      }).catch(console.error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/users:role] 역할 변경 실패:", (error as Error).message)
    return NextResponse.json({ error: "역할 변경 실패" }, { status: 500 })
  }
}
