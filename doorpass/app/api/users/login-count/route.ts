import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  const { count, error } = await supabaseAdmin
    .from("login_history")
    .select("id", { count: "exact", head: true })
    .eq("user_email", user!.email)

  if (error) {
    console.error("[Login Count] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }

  return NextResponse.json({ count: count ?? 0 })
}

export async function POST() {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { error } = await supabaseAdmin
      .from("login_history")
      .insert({ user_email: user!.email })

    if (error) {
      console.error("[Login Count] 기록 오류:", error)
      return NextResponse.json({ error: "기록 실패" }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Login Count] 오류:", error)
    return NextResponse.json({ error: "기록 실패" }, { status: 500 })
  }
}
