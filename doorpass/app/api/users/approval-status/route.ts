import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { unauthorized, user } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { data: approvedUser } = await supabaseAdmin
      .from("approved_users")
      .select("id")
      .eq("email", user!.email)
      .maybeSingle()

    if (approvedUser) {
      return NextResponse.json({ status: "approved" })
    }

    const { data: pendingApproval } = await supabaseAdmin
      .from("pending_approvals")
      .select("status, selected_branch_id")
      .eq("user_email", user!.email)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle()

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
