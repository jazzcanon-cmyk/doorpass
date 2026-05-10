import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getAverageRating } from "@/lib/delivery-ratings"

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const email = searchParams.get("email")

  if (!email?.trim()) {
    return NextResponse.json({ error: "email 파라미터가 필요합니다." }, { status: 400 })
  }

  try {
    const result = await getAverageRating(email.trim())
    return NextResponse.json(result)
  } catch (error) {
    console.error("[ratings:average] 실패:", (error as Error).message)
    return NextResponse.json({ error: "평균 평점 조회 실패" }, { status: 500 })
  }
}
