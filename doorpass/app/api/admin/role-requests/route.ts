import { NextResponse } from "next/server"
import { requireManagerApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

const supabase = supabaseAdmin

const ALLOWED_STATUS = new Set(["pending", "approved", "rejected"])

export async function GET(request: Request) {
  try {
    const { user, role, unauthorized } = await requireManagerApi()
    if (unauthorized) return unauthorized

    const url = new URL(request.url)
    const statusParam = url.searchParams.get("status") ?? "pending"
    const status = ALLOWED_STATUS.has(statusParam) ? statusParam : "pending"

    const { data, error } = await supabase
      .from("role_requests")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (role === "sub_admin" && user?.email) {
      const { data: me } = await supabase
        .from("approved_users")
        .select("branch_id")
        .eq("email", user.email)
        .maybeSingle()
      const myBranch = me?.branch_id
      if (!myBranch) return NextResponse.json({ requests: [] })

      const userEmails = (data ?? []).map((r) => r.user_email).filter(Boolean)
      const { data: approvedUsers } = await supabase
        .from("approved_users")
        .select("email, branch_id")
        .in("email", userEmails)

      const branchByEmail = new Map((approvedUsers ?? []).map((u) => [u.email, u.branch_id]))
      const filtered = (data ?? []).filter((r) => branchByEmail.get(r.user_email) === myBranch)
      return NextResponse.json({ requests: filtered })
    }

    return NextResponse.json({ requests: data ?? [] })
  } catch (error) {
    console.error("[role-requests] 오류:", (error as Error).message)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
