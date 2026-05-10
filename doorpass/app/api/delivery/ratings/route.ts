import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { createRating, getRatingsByEmail } from "@/lib/delivery-ratings"

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const { ratedEmail, deliveryRequestId, rating, comment } = body as {
      ratedEmail?: string
      deliveryRequestId?: number | null
      rating?: number
      comment?: string | null
    }

    if (!ratedEmail?.trim()) {
      return NextResponse.json({ error: "평가 대상 이메일이 필요합니다." }, { status: 400 })
    }
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "평점은 1~5 사이여야 합니다." }, { status: 400 })
    }
    if (ratedEmail === user!.email!) {
      return NextResponse.json({ error: "자기 자신을 평가할 수 없습니다." }, { status: 400 })
    }

    const created = await createRating({
      ratedEmail: ratedEmail.trim(),
      raterEmail: user!.email!,
      deliveryRequestId: deliveryRequestId ?? null,
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
