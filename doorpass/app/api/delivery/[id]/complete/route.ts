import { NextResponse } from "next/server"
import { requireAuth, resolveUserEmail } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function PATCH(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { id } = await ctx.params

    const { data: req } = await supabaseAdmin
      .from("delivery_requests")
      .select("requester_email, status")
      .eq("id", id)
      .maybeSingle()

    if (!req) return NextResponse.json({ error: "요청 없음" }, { status: 404 })

    const row = req as { requester_email: string; status: string }

    if (row.requester_email !== resolveUserEmail(user!)) {
      return NextResponse.json({ error: "의뢰자만 거래완료 처리할 수 있습니다." }, { status: 403 })
    }

    if (row.status !== "matched") {
      return NextResponse.json({ error: "매칭된 거래만 완료 처리할 수 있습니다." }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from("delivery_requests")
      .update({ status: "closed", completed_at: new Date().toISOString() })
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[delivery:complete] 처리 실패:", (error as Error).message)
    return NextResponse.json({ error: "처리 실패" }, { status: 500 })
  }
}
