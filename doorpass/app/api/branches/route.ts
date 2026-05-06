import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { data, error } = await supabaseAdmin
      .from("branches")
      .select("id, name, region, type")
      .order("region", { ascending: true })
      .order("name", { ascending: true })

    if (error) throw error
    return NextResponse.json(
      { branches: data ?? [] },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", "Vary": "Cookie" } }
    )
  } catch (error) {
    console.error("[branches] 조회 실패:", (error as Error).message)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}
