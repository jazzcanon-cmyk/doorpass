import { NextResponse } from "next/server"
import { requireManagerApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendPushToUser } from "@/lib/push"

const ALLOWED_STATUS = new Set(["new", "reading", "resolved", "rejected"])

// 관리자 — 피드백 상태 변경 + 답변
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, unauthorized } = await requireManagerApi()
    if (unauthorized) return unauthorized

    const { id: idParam } = await params
    const id = Number(idParam)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "잘못된 id" }, { status: 400 })
    }

    let body: { status?: string; admin_reply?: string | null } = {}
    try {
      body = await request.json()
    } catch {}

    const status = typeof body.status === "string" ? body.status : null
    const adminReply =
      typeof body.admin_reply === "string" ? body.admin_reply.trim() : null

    if (status && !ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ error: "잘못된 상태" }, { status: 400 })
    }
    if (!status && !adminReply) {
      return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 })
    }

    const adminEmail = user?.email ?? "unknown"
    const update: Record<string, unknown> = {}
    if (status) update.status = status
    if (adminReply !== null && adminReply !== "") {
      update.admin_reply = adminReply
      update.replied_at = new Date().toISOString()
      update.replied_by = adminEmail
    }

    const { data: updated, error } = await supabaseAdmin
      .from("feedbacks")
      .update(update)
      .eq("id", id)
      .select("id, user_email, user_name, category, status, admin_reply")
      .maybeSingle()

    if (error || !updated) {
      console.error("[admin/feedbacks:update] 실패:", (error as Error).message)
      return NextResponse.json({ error: "처리 실패" }, { status: 500 })
    }

    // 답변이 추가되면 회원에게 푸시
    if (adminReply && updated.user_email) {
      void sendPushToUser(updated.user_email as string, {
        title: "💬 피드백에 답변이 달렸어요!",
        body: adminReply.slice(0, 80),
        url: "/settings",
      }).catch(console.error)
    }

    return NextResponse.json({ success: true, feedback: updated })
  } catch (error) {
    console.error("[admin/feedbacks:update] 처리 실패:", (error as Error).message)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
