import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAdminApi } from "@/lib/auth"

type Params = Promise<{ id: string }>

export async function GET(request: Request, { params }: { params: Params }) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const { id: encodedEmail } = await params
  const email = decodeURIComponent(encodedEmail)

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200)
  const offset = Number(searchParams.get("offset") ?? "0")
  const activityType = searchParams.get("activity_type")
  const startDate = searchParams.get("start_date")
  const endDate = searchParams.get("end_date")

  let query = supabaseAdmin
    .from("user_activity_logs")
    .select("*", { count: "exact" })
    .eq("user_email", email)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (activityType) query = query.eq("activity_type", activityType)
  if (startDate)    query = query.gte("created_at", startDate)
  if (endDate)      query = query.lte("created_at", endDate)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [], total: count ?? 0, limit, offset })
}
