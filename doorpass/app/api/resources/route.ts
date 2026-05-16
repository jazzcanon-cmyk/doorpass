import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { requireAuth, requireAdminApi, resolveUserEmail } from "@/lib/auth"
import { logActivity, getIp } from "@/lib/activity-logger"

const supabase = supabaseAdmin

const RESOURCE_TYPES = new Set(["link", "file", "image", "document", "text"])

export async function GET(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) throw new Error(error.message)
    logActivity(resolveUserEmail(user!), "resource_view", { count: data?.length ?? 0 }, getIp(request))
    return NextResponse.json({ resources: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "자료를 불러오지 못했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // 등록·삭제는 관리자만 허용
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized
  try {
    const body = await request.json()
    const { action, ...payload } = body as { action?: string; [key: string]: unknown }

    if (action === "delete") {
      const id = Number(payload.id)
      if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 })
      const { error } = await supabase.from("resources").delete().eq("id", id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true })
    }

    const { title, description, resource_type, url, author } = payload as {
      title?: string
      description?: string | null
      resource_type?: string
      url?: string | null
      author?: string
    }
    if (!title || !title.trim()) {
      return NextResponse.json({ error: "title이 필요합니다." }, { status: 400 })
    }
    if (!resource_type || !RESOURCE_TYPES.has(resource_type)) {
      return NextResponse.json({ error: "지원하지 않는 resource_type 입니다." }, { status: 400 })
    }

    const insertData = {
      title: title.trim(),
      description: description ?? null,
      resource_type,
      url: url ?? null,
      author: author?.trim() || "관리자",
    }
    const { error } = await supabase.from("resources").insert(insertData)
    if (error) throw new Error(error.message)

    const TYPE_LABELS: Record<string, string> = { link: "링크", file: "파일", image: "이미지", document: "문서", text: "글" }
    sendTelegramMessage(
      `📁 [DoorPass] 새 자료 등록: ${insertData.title}\n유형: ${TYPE_LABELS[resource_type] ?? resource_type}\n등록자: ${insertData.author}\n시간: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
    ).catch((err) => console.error("[Telegram] 자료실 알림 전송 실패:", err))

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "처리에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
