import { NextResponse } from "next/server"
import { requireManagerApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { user, role, unauthorized } = await requireManagerApi()
  if (unauthorized) return unauthorized

  try {
    const email = user?.email ?? "unknown"
    const meta = user?.user_metadata as Record<string, unknown> | undefined
    const userId =
      ((meta?.provider_id as string | undefined) ??
        (meta?.sub as string | undefined) ??
        (user?.id ?? "")) as string

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
      .select("id, user_email, user_name, kakao_name, kakao_nickname, profile_image_url, selected_branch_id, requested_at, reason, branches(id, name, region)")
      .eq("status", "pending")
      .order("requested_at", { ascending: false })

    if (role === "sub_admin") {
      if (!currentUser?.branch_id) return NextResponse.json({ approvals: [] })
      // 부관리자: 자기 대리점 요청만 + 기타(etc-branch) 제외
      query = query
        .eq("selected_branch_id", currentUser.branch_id)
        .neq("selected_branch_id", "etc-branch")
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ approvals: data ?? [] })
  } catch (error) {
    console.error("[Pending Approvals] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}
