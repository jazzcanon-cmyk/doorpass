import { NextResponse } from "next/server"
import { requireManagerApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { user, role, unauthorized } = await requireManagerApi()
  if (unauthorized) return unauthorized

  try {
    const { data: currentUser } = await supabaseAdmin
      .from("approved_users")
      .select("branch_id")
      .eq("email", user!.email)
      .maybeSingle()

    let query = supabaseAdmin
      .from("pending_approvals")
      .select("id, user_email, user_name, selected_branch_id, requested_at, branches(id, name, region)")
      .eq("status", "pending")
      .order("requested_at", { ascending: false })

    if (role === "sub_admin") {
      if (!currentUser?.branch_id) return NextResponse.json({ approvals: [] })
      query = query.eq("selected_branch_id", currentUser.branch_id)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ approvals: data ?? [] })
  } catch (error) {
    console.error("[Pending Approvals] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}
