import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAdminApi } from "@/lib/auth"

export async function GET() {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const {
      data: { users: authUsers },
      error: authError,
    } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (authError) throw authError

    const { data: approvedUsers, error: approvedError } = await supabaseAdmin
      .from("approved_users")
      .select("id, email, role, is_active, is_blocked, blocked_reason")
    if (approvedError) throw approvedError

    const approvedMap = new Map(
      (approvedUsers ?? [])
        .filter((u) => u.email)
        .map((u) => [u.email!.toLowerCase(), u])
    )

    const users = authUsers.map((u) => {
      const email = u.email?.toLowerCase() ?? ""
      const approved = approvedMap.get(email)
      const provider = (u.app_metadata?.provider as string | undefined) ?? "unknown"
      return {
        id: u.id,
        email: u.email ?? null,
        name:
          (u.user_metadata?.name as string | undefined) ??
          (u.user_metadata?.full_name as string | undefined) ??
          null,
        avatar_url: (u.user_metadata?.avatar_url as string | undefined) ?? null,
        provider,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        role: approved?.role ?? null,
        is_active: approved?.is_active ?? null,
        is_registered: !!approved,
        approved_id: approved?.id ?? null,
        is_blocked: approved?.is_blocked ?? false,
        blocked_reason: approved?.blocked_reason ?? null,
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Error fetching auth users:", error)
    return NextResponse.json({ error: "Failed to fetch auth users" }, { status: 500 })
  }
}
