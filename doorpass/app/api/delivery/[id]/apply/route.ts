import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { id } = await ctx.params
    const body = await request.json().catch(() => ({}))
    const { message, name, phone } = body
    const applicantRealName = name?.toString().trim() || null
    const applicantPhone = phone?.toString().trim() || null

    const { data: req } = await supabaseAdmin
      .from("delivery_requests")
      .select("id, requester_email, status, request_date, area")
      .eq("id", id)
      .maybeSingle()

    if (!req) return NextResponse.json({ error: "요청 없음" }, { status: 404 })
    const reqRow = req as {
      requester_email: string
      status: string
      request_date: string
      area: string | null
    }

    if (reqRow.requester_email === user!.email!) {
      return NextResponse.json({ error: "본인 요청에는 신청할 수 없습니다." }, { status: 400 })
    }
    if (reqRow.status !== "open") {
      return NextResponse.json({ error: "이미 마감되었습니다." }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from("delivery_applications")
      .select("id")
      .eq("request_id", id)
      .eq("applicant_email", user!.email!)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: "이미 신청했습니다.", alreadyApplied: true }, { status: 400 })
    }

    const applicantName =
      (user!.user_metadata?.name as string | undefined) ||
      (user!.user_metadata?.full_name as string | undefined) ||
      user!.email!

    const { data, error } = await supabaseAdmin
      .from("delivery_applications")
      .insert({
        request_id: id,
        applicant_email: user!.email!,
        applicant_name: applicantName,
        message: (message ?? "").toString().trim() || null,
        applicant_real_name: applicantRealName,
        applicant_phone: applicantPhone,
        status: "pending",
      })
      .select()
      .single()

    if (error) throw error

    sendTelegramMessage(
      `[대체배송] 신청자가 있어요!\n신청자: ${applicantName}${applicantPhone ? ' (' + applicantPhone + ')' : ''}\n날짜: ${reqRow.request_date}\n확인하러가기: https://doorpass.kr/delivery`
    ).catch(console.error)

    // 요청자에게 푸시 알림
    fetch(new URL("/api/push/send", request.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "" },
      body: JSON.stringify({
        userEmail: reqRow.requester_email,
        title: "대체배송 신청이 들어왔어요!",
        body: applicantName + "님이 신청했습니다. 앱에서 확인하세요.",
        url: "/delivery",
      }),
    }).catch(console.error)

    return NextResponse.json({ application: data })
  } catch (error) {
    console.error("[Delivery apply] 오류:", error)
    return NextResponse.json({ error: "신청 실패" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { id } = await ctx.params
    const { error } = await supabaseAdmin
      .from("delivery_applications")
      .delete()
      .eq("request_id", id)
      .eq("applicant_email", user!.email!)
      .eq("status", "pending")

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Delivery apply DELETE] 오류:", error)
    return NextResponse.json({ error: "취소 실패" }, { status: 500 })
  }
}
