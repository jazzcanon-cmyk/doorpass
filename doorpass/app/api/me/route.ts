import { NextResponse } from "next/server"
import { requireAuth, getUserRole } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { user, isAdmin, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const role = await getUserRole(user!.email)

  let name: string | null = null
  let managed_region: string | null = null
  if (user!.email) {
    const { data } = await supabaseAdmin
      .from("approved_users")
      .select("name, managed_region")
      .eq("email", user!.email)
      .maybeSingle()
    name = (data?.name as string | undefined) ?? null
    managed_region = (data?.managed_region as string | undefined) ?? null
  }

  return NextResponse.json({
    id: user!.id,
    email: user!.email ?? null,
    name,
    managed_region,
    isAdmin,
    role,
    canEdit: role === "admin" || role === "sub_admin" || role === "editor",
    canUploadCSV: role === "admin" || role === "sub_admin",
  })
}
