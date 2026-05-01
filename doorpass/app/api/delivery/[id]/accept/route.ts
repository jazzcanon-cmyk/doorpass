import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { id } = await ctx.params
    const body = await request.json()
    const applicationId = body?.applicationId
    const action = (body?.action ?? "accept") as "accept" | "reject"
    if (!applicationId) {
      return NextResponse.json({ error: "applicationId 필요" }, { status: 400 })
    }

    const { data: req } = await supabaseAdmin
      .from("delivery_requests")
      .select("id, user_email, status, delivery_date, area_description")
      .eq("id", id)
      .maybeSingle()
    if (!req) return NextResponse.json({ error: "요청 없음" }, { status: 404 })

    const reqRow = req as {
      id: number | string
      user_email: string
      status: string
      delivery_date: string
      area_description: string | null
    }

    if (reqRow.user_email !== user!.email!) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 })
    }

    const { data: app } = await supabaseAdmin
      .from("delivery_applications")
      .select("id, applicant_email, applicant_name, status")
      .eq("id", applicationId)
      .eq("request_id", id)
      .maybeSingle()

    if (!app) return NextResponse.json({ error: "신청 없음" }, { status: 404 })
    const appRow = app as {
      id: number | string
      applicant_email: string
      applicant_name: string | null
      status: string
    }

    if (action === "reject") {
      await supabaseAdmin
        .from("delivery_applications")
        .update({ status: "rejected" })
        .eq("id", applicationId)
      return NextResponse.json({ success: true })
    }

    if (reqRow.status !== "open") {
      return NextResponse.json({ error: "이미 매칭되었습니다." }, { status: 400 })
    }

    // 수락: 요청 상태 변경 + 다른 신청자 거부 처리
    const { error: reqErr } = await supabaseAdmin
      .from("delivery_requests")
      .update({
        status: "matched",
        matched_email: appRow.applicant_email,
      })
      .eq("id", id)
    if (reqErr) throw reqErr

    await supabaseAdmin
      .from("delivery_applications")
      .update({ status: "accepted" })
      .eq("id", applicationId)

    await supabaseAdmin
      .from("delivery_applications")
      .update({ status: "rejected" })
      .eq("request_id", id)
      .neq("id", applicationId)
      .eq("status", "pending")

    sendTelegramMessage(
      `[대리배송] 매칭 완료!\n${reqRow.delivery_date} ${reqRow.area_description ?? ""} 대리배송`
    ).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Delivery accept] 오류:", error)
    return NextResponse.json({ error: "처리 실패" }, { status: 500 })
  }
}
