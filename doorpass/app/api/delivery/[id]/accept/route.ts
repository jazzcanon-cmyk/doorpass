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
      .select("id, requester_email, status, request_date, area")
      .eq("id", id)
      .maybeSingle()
    if (!req) return NextResponse.json({ error: "요청 없음" }, { status: 404 })

    const reqRow = req as {
      id: number | string
      requester_email: string
      status: string
      request_date: string
      area: string | null
    }

    if (reqRow.requester_email !== user!.email!) {
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

    const { error: reqErr } = await supabaseAdmin
      .from("delivery_requests")
      .update({
        status: "matched",
        matched_email: appRow.applicant_email,
        matched_name: appRow.applicant_name,
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
      `[대체배송] 매칭 완료!\n${reqRow.request_date} ${reqRow.area ?? ""} 대체배송`
    ).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[delivery:accept] 처리 실패:", (error as Error).message)
    return NextResponse.json({ error: "처리 실패" }, { status: 500 })
  }
}
