import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { data: me } = await supabaseAdmin
      .from("approved_users")
      .select("role, branch_id")
      .eq("email", user!.email)
      .maybeSingle()

    if (!me || (me.role !== "sub_admin" && me.role !== "admin")) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 })
    }

    let query = supabaseAdmin
      .from("buildings")
      .select("id, name, address, region, created_at")
      .order("created_at", { ascending: false })

    if (me.role === "sub_admin") {
      query = query.eq("branch_id", me.branch_id)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({
      buildings: (data || []).map((b) => ({
        id: b.id,
        name: b.name || b.address || "이름 없음",
        address: b.address || "",
        region: b.region || null,
        created_at: b.created_at,
      })),
    })
  } catch (error) {
    console.error("[Sub-Admin Buildings] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}
