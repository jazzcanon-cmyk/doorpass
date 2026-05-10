import { NextResponse } from "next/server"
import { requireAuth, resolveUserEmail } from "@/lib/auth"
import { createRating, getRatingsByEmail } from "@/lib/delivery-ratings"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const { deliveryRequestId, rating, comment } = body as {
      deliveryRequestId?: number | null
      rating?: number
      comment?: string | null
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "평점은 1~5 사이여야 합니다." }, { status: 400 })
    }
    if (!deliveryRequestId) {
      return NextResponse.json({ error: "거래 ID가 필요합니다." }, { status: 400 })
    }

    // 서버에서 직접 delivery 검증 — 클라이언트 ratedEmail 무시
    const { data: delivery } = await supabaseAdmin
      .from("delivery_requests")
      .select("status, requester_email, matched_email")
      .eq("id", deliveryRequestId)
      .maybeSingle()

    if (!delivery) {
      return NextResponse.json({ error: "해당 거래를 찾을 수 없습니다." }, { status: 404 })
    }

    const row = delivery as { status: string; requester_email: string; matched_email: string | null }

    if (row.status !== "closed") {
      return NextResponse.json({ error: "거래완료된 배송에만 평점을 입력할 수 있습니다." }, { status: 400 })
    }

    const isRequester = row.requester_email === resolveUserEmail(user!)
    const isDriver = row.matched_email === resolveUserEmail(user!)

    if (!isRequester && !isDriver) {
      return NextResponse.json({ error: "해당 거래의 당사자만 평점을 입력할 수 있습니다." }, { status: 403 })
    }

    // 중복 평점 방지
    const { data: existingRating } = await supabaseAdmin
      .from("delivery_ratings")
      .select("id")
      .eq("delivery_request_id", deliveryRequestId)
      .eq("rater_email", resolveUserEmail(user!))
      .maybeSingle()

    if (existingRating) {
      return NextResponse.json({ error: "이미 평점을 매겼습니다." }, { status: 400 })
    }

    // 서버에서 rated_email 결정 (클라이언트 조작 불가)
    const determinedRatedEmail = isRequester ? row.matched_email : row.requester_email
    if (!determinedRatedEmail) {
      return NextResponse.json({ error: "평가 대상을 찾을 수 없습니다." }, { status: 400 })
    }

    const created = await createRating({
      ratedEmail: determinedRatedEmail,
      raterEmail: resolveUserEmail(user!),
      deliveryRequestId,
      rating,
      comment,
    })

    return NextResponse.json({ rating: created }, { status: 201 })
  } catch (error) {
    console.error("[ratings:create] 실패:", (error as Error).message)
    return NextResponse.json({ error: "평점 등록 실패" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const email = searchParams.get("email")

  if (!email?.trim()) {
    return NextResponse.json({ error: "email 파라미터가 필요합니다." }, { status: 400 })
  }

  try {
    const ratings = await getRatingsByEmail(email.trim())
    return NextResponse.json({ ratings })
  } catch (error) {
    console.error("[ratings:list] 실패:", (error as Error).message)
    return NextResponse.json({ error: "평점 조회 실패" }, { status: 500 })
  }
}
