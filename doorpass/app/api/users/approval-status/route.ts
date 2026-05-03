import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const email = user!.email
    const meta = user!.user_metadata as Record<string, unknown> | undefined
    const userId =
      ((meta?.provider_id as string | undefined) ??
        (meta?.sub as string | undefined) ??
        user!.id) as string

    // approved_users: email 우선, 실패 시 kakao_id로 fallback
    let approvedUser: { id: string } | null = null
    if (email) {
      const { data } = await supabaseAdmin
        .from("approved_users")
        .select("id")
        .eq("email", email)
        .maybeSingle()
      approvedUser = data
    }
    if (!approvedUser) {
      const { data } = await supabaseAdmin
        .from("approved_users")
        .select("id")
        .eq("kakao_id", userId)
        .maybeSingle()
      approvedUser = data
    }

    if (approvedUser) {
      return NextResponse.json({ status: "approved" })
    }

    // pending_approvals: email 기반 조회 (email 없는 카카오 사용자는 미지원 — none 반환)
    let pendingApproval: { status: string; selected_branch_id: string } | null = null
    if (email) {
      const { data } = await supabaseAdmin
        .from("pending_approvals")
        .select("status, selected_branch_id")
        .eq("user_email", email)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      pendingApproval = data
    }

    if (!pendingApproval) {
      return NextResponse.json({ status: "none" })
    }

    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("name")
      .eq("id", pendingApproval.selected_branch_id)
      .maybeSingle()

    return NextResponse.json({
      status: pendingApproval.status,
      branchName: branch?.name ?? "",
    })
  } catch (error) {
    console.error("[Approval Status] 오류:", error)
    return NextResponse.json({ status: "error" }, { status: 500 })
  }
}
