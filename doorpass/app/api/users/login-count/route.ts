import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

function resolveIdentifier(user: NonNullable<Awaited<ReturnType<typeof requireAuth>>["user"]>) {
  const email = user.email
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const userId =
    ((meta?.provider_id as string | undefined) ??
      (meta?.sub as string | undefined) ??
      user.id) as string
  return email || userId
}

export async function GET() {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  const identifier = resolveIdentifier(user!)

  const { count, error } = await supabaseAdmin
    .from("login_history")
    .select("id", { count: "exact", head: true })
    .eq("user_email", identifier)

  if (error) {
    console.error("[users/login-count] 조회 실패:", (error as Error).message)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }

  return NextResponse.json({ count: count ?? 0 })
}

export async function POST() {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  const identifier = resolveIdentifier(user!)

  try {
    const { error } = await supabaseAdmin
      .from("login_history")
      .insert({ user_email: identifier })

    if (error) {
      console.error("[users/login-count:record] 기록 실패:", (error as Error).message)
      return NextResponse.json({ error: "기록 실패" }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[users/login-count:record] 처리 실패:", (error as Error).message)
    return NextResponse.json({ error: "기록 실패" }, { status: 500 })
  }
}
