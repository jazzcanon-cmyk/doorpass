import { NextResponse } from "next/server"
import { requireManagerApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { user, role, unauthorized } = await requireManagerApi()
  if (unauthorized) return unauthorized

  try {
    const email = user!.email
    const meta = user!.user_metadata as Record<string, unknown> | undefined
    const userId =
      ((meta?.provider_id as string | undefined) ??
        (meta?.sub as string | undefined) ??
        user!.id) as string

    let currentUser: { branch_id: string | null } | null = null
    if (email) {
      const { data } = await supabaseAdmin
        .from("approved_users")
        .select("branch_id")
        .eq("email", email)
        .maybeSingle()
      currentUser = data
    }
    if (!currentUser) {
      const { data } = await supabaseAdmin
        .from("approved_users")
        .select("branch_id")
        .eq("kakao_id", userId)
        .maybeSingle()
      currentUser = data
    }

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
