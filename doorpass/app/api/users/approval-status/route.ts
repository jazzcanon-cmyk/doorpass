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

    // approved_users 조회 (email → kakao_id 순)
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
    if (approvedUser) return NextResponse.json({ status: "approved", canRevealBuildingPassword: true })

    // pending_approvals 조회 (email, userId 순회)
    let pendingApproval: { status: string; selected_branch_id: string } | null = null
    const identifiers = [email, userId].filter(Boolean) as string[]
    for (const id of identifiers) {
      const { data } = await supabaseAdmin
        .from("pending_approvals")
        .select("status, selected_branch_id")
        .eq("user_email", id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) {
        pendingApproval = data
        break
      }
    }

    if (!pendingApproval) return NextResponse.json({ status: "none", canRevealBuildingPassword: false })

    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("name")
      .eq("id", pendingApproval.selected_branch_id)
      .maybeSingle()

    return NextResponse.json({
      status: pendingApproval.status,
      branchName: branch?.name ?? "",
      canRevealBuildingPassword: false,
    })
  } catch (error) {
    console.error("[users/approval-status] 조회 실패:", (error as Error).message)
    return NextResponse.json({ status: "error" }, { status: 500 })
  }
}
