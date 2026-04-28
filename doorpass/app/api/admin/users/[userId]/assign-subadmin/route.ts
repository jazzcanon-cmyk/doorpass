import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

const supabase = supabaseAdmin

const ALLOWED_ROLES = new Set(["admin", "sub_admin", "editor", "driver"])

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  sub_admin: "부관리자",
  editor: "편집자",
  driver: "일반 사용자",
}

type Params = Promise<{ userId: string }>

export async function POST(request: Request, { params }: { params: Params }) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const { userId } = await params
  if (!userId) return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as {
    role?: string
    managed_region?: string | null
  }
  const role = body.role
  const managed_region = body.managed_region ?? null

  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("approved_users")
    .update({
      role,
      managed_region: role === "sub_admin" ? (managed_region ? String(managed_region).trim() : null) : null,
    })
    .eq("id", userId)
    .select("email, name")
    .maybeSingle()

  if (error) {
    console.error("[assign-subadmin] update error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  sendTelegramMessage(
    `🔑 역할 변경\n👤 ${data.name ?? "(이름 없음)"} (${data.email ?? "-"})\n📋 새 역할: ${ROLE_LABEL[role] ?? role}${
      role === "sub_admin" && managed_region ? `\n📍 관리 지역: ${managed_region}` : ""
    }`
  ).catch(console.error)

  return NextResponse.json({ success: true })
}
