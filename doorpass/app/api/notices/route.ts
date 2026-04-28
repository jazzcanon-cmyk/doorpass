import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { requireAuth, requireAdminApi } from "@/lib/auth"
import { logActivity, getIp } from "@/lib/activity-logger"

const supabase = supabaseAdmin

export async function GET(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const { data, error } = await supabase
      .from("notices")
      .select("*")
      .order("is_important", { ascending: false })
      .order("created_at", { ascending: false })
    if (error) throw new Error(error.message)
    logActivity(user!.email!, "notice_view", { count: data?.length ?? 0 }, getIp(request))
    return NextResponse.json({ notices: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "공지사항을 불러오지 못했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // 공지 등록·삭제는 관리자만 허용
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized
  try {
    const body = await request.json()
    const { action, ...payload } = body as { action?: string; [key: string]: unknown }

    if (action === "delete") {
      const id = Number(payload.id)
      if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 })
      const { error } = await supabase.from("notices").delete().eq("id", id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true })
    }

    const { title, content, author, is_important } = payload as {
      title?: string
      content?: string
      author?: string
      is_important?: boolean
    }
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "title과 content가 필요합니다." }, { status: 400 })
    }
    const insertData = {
      title: title.trim(),
      content: content.trim(),
      author: author?.trim() || "관리자",
      is_important: !!is_important,
    }
    const { error } = await supabase.from("notices").insert(insertData)
    if (error) throw new Error(error.message)
    sendTelegramMessage(`📣 새 공지사항\n제목: ${insertData.title}`).catch(console.error)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "처리에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
