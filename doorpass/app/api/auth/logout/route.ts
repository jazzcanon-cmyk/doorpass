import { NextResponse } from "next/server"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase-route"

export async function POST() {
  try {
    const supabase = await createSupabaseRouteHandlerClient()
    await supabase.auth.signOut()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[auth/logout] 처리 실패:", (error as Error).message)
    return NextResponse.json({ error: "로그아웃 실패" }, { status: 500 })
  }
}
