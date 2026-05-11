import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

// 관리자 — 전체 교환 신청 목록 (pending 우선, 최신순)
export async function GET() {
  try {
    const { unauthorized } = await requireAdminApi()
    if (unauthorized) return unauthorized

    const { data, error } = await supabaseAdmin
      .from("point_exchanges")
      .select(
        "id, email, name, points, status, created_at, method"
      )
      // pending(0) → completed/rejected(1) 순서 정렬을 위해 created 시간으로 보조 정렬
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) {
      console.error("[admin/exchanges:list] 조회 실패:", (error as Error).message)
      return NextResponse.json({ exchanges: [] }, { status: 500 })
    }

    // pending 을 항상 맨 위로
    const rows = (data ?? []) as Array<{ status: string }>
    const sorted = rows.sort((a, b) => {
      if (a.status === b.status) return 0
      if (a.status === "pending") return -1
      if (b.status === "pending") return 1
      return 0
    })

    const pendingCount = sorted.filter((r) => r.status === "pending").length

    return NextResponse.json({ exchanges: sorted, pendingCount })
  } catch (error) {
    console.error("[admin/exchanges:list] 처리 실패:", (error as Error).message)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
