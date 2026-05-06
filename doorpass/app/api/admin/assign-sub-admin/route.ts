import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

export async function POST(request: Request) {
  try {
    const { unauthorized } = await requireAdminApi()
    if (unauthorized) return unauthorized

    const body = (await request.json().catch(() => ({}))) as {
      branchId?: string
      userEmail?: string
    }

    const branchId = String(body.branchId ?? "").trim()
    const userEmail = String(body.userEmail ?? "").trim().toLowerCase()

    if (!branchId || !userEmail) {
      return NextResponse.json({ error: "branchId와 userEmail이 필요합니다." }, { status: 400 })
    }

    // 대리점 정보 조회
    const { data: branch, error: branchError } = await supabaseAdmin
      .from("branches")
      .select("id, name, manager_email")
      .eq("id", branchId)
      .maybeSingle()

    if (branchError) {
      console.error("[assign-sub-admin] branch error:", branchError)
      return NextResponse.json({ error: "대리점 조회 실패" }, { status: 500 })
    }
    if (!branch) {
      return NextResponse.json({ error: "대리점을 찾을 수 없습니다." }, { status: 404 })
    }

    // 새 부관리자 정보 조회
    const { data: newManager, error: newManagerError } = await supabaseAdmin
      .from("approved_users")
      .select("id, name, email, role")
      .eq("email", userEmail)
      .maybeSingle()

    if (newManagerError) {
      console.error("[assign-sub-admin] new manager error:", newManagerError)
      return NextResponse.json({ error: "사용자 조회 실패" }, { status: 500 })
    }
    if (!newManager) {
      return NextResponse.json({ error: "해당 이메일의 사용자를 찾을 수 없습니다." }, { status: 404 })
    }

    // 다중 부관리자 지원: 기존 부관리자 강등하지 않음, 새 부관리자만 추가 승격
    const { error: updateError } = await supabaseAdmin
      .from("approved_users")
      .update({ role: "sub_admin", branch_id: branchId })
      .eq("id", newManager.id)

    if (updateError) {
      console.error("[assign-sub-admin] update error:", updateError)
      return NextResponse.json({ error: "역할 변경 실패" }, { status: 500 })
    }

    // 대리점 manager 정보 업데이트
    const { error: branchUpdateError } = await supabaseAdmin
      .from("branches")
      .update({
        manager_email: userEmail,
        manager_name: newManager.name ?? null,
      })
      .eq("id", branchId)

    if (branchUpdateError) {
      console.error("[assign-sub-admin] branch update error:", branchUpdateError)
      return NextResponse.json({ error: "대리점 정보 업데이트 실패" }, { status: 500 })
    }

    sendTelegramMessage(
      `🔑 부관리자 지정\n🏢 대리점: ${branch.name}\n👤 ${newManager.name ?? "(이름 없음)"} (${userEmail})\n📋 역할: 부관리자`
    ).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[assign-sub-admin] 오류:", (error as Error).message)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
