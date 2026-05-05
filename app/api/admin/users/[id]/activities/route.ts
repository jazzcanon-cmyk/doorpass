import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { getUserActivities } from "@/lib/activity-tracker"

type Params = Promise<{ id: string }>

export async function GET(
  _request: Request,
  { params }: { params: Params }
) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const { id: encodedEmail } = await params
  const userEmail = decodeURIComponent(encodedEmail)
  const { data, error } = await getUserActivities(userEmail, 100)

  if (error) {
    return NextResponse.json({ error: "활동 내역 조회 실패" }, { status: 500 })
  }
  return NextResponse.json({ activities: data ?? [] })
}

