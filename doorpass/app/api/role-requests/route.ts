import { NextResponse } from "next/server"
import { requireAuth, getUserRole, resolveUserEmail } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

const supabase = supabaseAdmin

// GET: 본인 요청 목록
export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data, error } = await supabase
    .from("role_requests")
    .select("*")
    .eq("user_email", resolveUserEmail(user!))
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}

// POST: 새 권한 요청
export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = (await request.json().catch(() => ({}))) as { reason?: string }
  const reason = (body.reason ?? "").trim()

  if (reason.length < 10) {
    return NextResponse.json(
      { error: "요청 사유를 10자 이상 입력해주세요." },
      { status: 400 }
    )
  }

  const role = await getUserRole(user!.email)
  if (role === "admin" || role === "editor") {
    return NextResponse.json({ error: "이미 편집 권한이 있습니다." }, { status: 400 })
  }

  // 본인 정보 (이름)
  const { data: userData } = await supabase
    .from("approved_users")
    .select("name")
    .eq("email", resolveUserEmail(user!))
    .maybeSingle()

  // 대기 중인 요청 중복 방지
  const { data: existing } = await supabase
    .from("role_requests")
    .select("id")
    .eq("user_email", resolveUserEmail(user!))
    .eq("status", "pending")
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "이미 대기 중인 요청이 있습니다." }, { status: 400 })
  }

  const userName = userData?.name ?? resolveUserEmail(user!).split("@")[0]

  const { data, error } = await supabase
    .from("role_requests")
    .insert({
      user_email: resolveUserEmail(user!),
      user_name: userName,
      requested_role: "editor",
      reason,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  sendTelegramMessage(
    `🙋 편집자 권한 요청\n👤 사용자: ${userName}\n📧 이메일: ${user!.email}\n📝 사유: ${reason}`
  ).catch(console.error)

  return NextResponse.json({ success: true, request: data })
}
