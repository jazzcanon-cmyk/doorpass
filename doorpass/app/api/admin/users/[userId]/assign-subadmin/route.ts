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
    email?: string | null
    name?: string | null
  }
  const role = body.role
  const managed_region = body.managed_region ?? null

  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const region =
    role === "sub_admin" ? (managed_region ? String(managed_region).trim() : null) : null

  // userId가 숫자면 approved_users.id, 아니면 URL-인코딩된 email로 처리
  const decoded = decodeURIComponent(userId)
  const numericId = /^\d+$/.test(decoded) ? Number(decoded) : null

  // 1) numericId 우선
  if (numericId !== null) {
    const { data, error } = await supabase
      .from("approved_users")
      .update({ role, managed_region: region })
      .eq("id", numericId)
      .select("email, name")
      .maybeSingle()
    if (error) {
      console.error("[assign-subadmin] update error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 })

    sendTelegramMessage(
      `🔑 역할 변경\n👤 ${data.name ?? "(이름 없음)"} (${data.email ?? "-"})\n📋 새 역할: ${
        ROLE_LABEL[role] ?? role
      }${role === "sub_admin" && region ? `\n📍 관리 지역: ${region}` : ""}`
    ).catch(console.error)
    return NextResponse.json({ success: true })
  }

  // 2) email 기반 fallback — 미등록(approved_users 없음)이면 자동 upsert
  const email = decoded.trim().toLowerCase()
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "유효하지 않은 식별자" }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from("approved_users")
    .select("id, name")
    .eq("email", email)
    .maybeSingle()

  let resolvedName: string | null = existing?.name ?? body.name?.trim() ?? null

  if (existing) {
    const { error } = await supabase
      .from("approved_users")
      .update({ role, managed_region: region })
      .eq("id", existing.id)
    if (error) {
      console.error("[assign-subadmin] update by email error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    const insertName = body.name?.trim() || email.split("@")[0]
    resolvedName = insertName
    const { error } = await supabase
      .from("approved_users")
      .insert({
        email,
        name: insertName,
        role,
        is_active: true,
        managed_region: region,
      })
    if (error) {
      console.error("[assign-subadmin] insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  sendTelegramMessage(
    `🔑 역할 변경\n👤 ${resolvedName ?? "(이름 없음)"} (${email})\n📋 새 역할: ${
      ROLE_LABEL[role] ?? role
    }${role === "sub_admin" && region ? `\n📍 관리 지역: ${region}` : ""}`
  ).catch(console.error)

  return NextResponse.json({ success: true })
}
