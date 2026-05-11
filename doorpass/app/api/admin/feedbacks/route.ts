import { NextResponse } from "next/server"
import { requireManagerApi, resolveUserEmail } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

const ALLOWED_STATUS = new Set(["new", "reading", "resolved", "rejected"])
const ALLOWED_CATEGORY = new Set(["bug", "feature", "complaint", "password_error", "general"])

// 관리자 — 전체 피드백 목록 (sub_admin 은 자기 대리점의 password_error 만)
export async function GET(request: Request) {
  try {
    const { user, role, unauthorized } = await requireManagerApi()
    if (unauthorized) return unauthorized

    const url = new URL(request.url)
    const statusParam = url.searchParams.get("status") ?? ""
    const categoryParam = url.searchParams.get("category") ?? ""

    let query = supabaseAdmin
      .from("feedbacks")
      .select(
        "id, user_email, user_name, category, building_id, building_name, content, status, admin_reply, replied_at, replied_by, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(300)

    if (statusParam && ALLOWED_STATUS.has(statusParam)) {
      query = query.eq("status", statusParam)
    }

    // sub_admin: password_error 만 + 자기 대리점 건물에 한해
    if (role === "sub_admin") {
      query = query.eq("category", "password_error")
    } else if (categoryParam && ALLOWED_CATEGORY.has(categoryParam)) {
      query = query.eq("category", categoryParam)
    }

    const { data, error } = await query
    if (error) {
      console.error("[admin/feedbacks:list] 조회 실패:", (error as Error).message)
      return NextResponse.json({ feedbacks: [], newCount: 0 })
    }

    let rows = data ?? []

    // sub_admin 의 building_id 별 branch 매칭 필터
    if (role === "sub_admin" && user) {
      const { data: me } = await supabaseAdmin
        .from("approved_users")
        .select("branch_id")
        .eq("email", resolveUserEmail(user!))
        .maybeSingle()
      const myBranch = me?.branch_id as string | null | undefined
      if (!myBranch) {
        return NextResponse.json({ feedbacks: [], newCount: 0 })
      }

      const buildingIds = Array.from(
        new Set(
          rows
            .map((r) => r.building_id as number | null)
            .filter((v): v is number => typeof v === "number")
        )
      )

      let allowedIds = new Set<number>()
      if (buildingIds.length > 0) {
        const { data: buildings } = await supabaseAdmin
          .from("buildings")
          .select("id, branch_id")
          .in("id", buildingIds)
        allowedIds = new Set(
          (buildings ?? [])
            .filter((b) => (b.branch_id as string | null) === myBranch)
            .map((b) => b.id as number)
        )
      }
      rows = rows.filter((r) => {
        const bid = r.building_id as number | null
        return bid != null && allowedIds.has(bid)
      })
    }

    const newCount = rows.filter((r) => r.status === "new").length
    return NextResponse.json({ feedbacks: rows, newCount })
  } catch (error) {
    console.error("[admin/feedbacks:list] 처리 실패:", (error as Error).message)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
