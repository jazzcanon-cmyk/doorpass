import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { requireAuth, getUserIdentifier, getUserName, resolveUserEmail } from "@/lib/auth"
import { logActivity, getIp } from "@/lib/activity-logger"

const supabase = supabaseAdmin

async function fetchMemoOwner(id: number) {
  const { data } = await supabase
    .from("calendar_memos")
    .select("kakao_id, author")
    .eq("id", id)
    .maybeSingle()
  return data as { kakao_id: string | null; author: string | null } | null
}

function canMutateMemo(
  owner: { kakao_id: string | null; author: string | null },
  identifier: string,
  userName: string,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true
  if (owner.kakao_id && owner.kakao_id === identifier) return true
  // 공개 메모(kakao_id === null)는 작성자 닉네임 일치만 허용
  if (owner.kakao_id === null && owner.author && owner.author === userName) return true
  return false
}

export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const identifier = getUserIdentifier(user!)
    const { data, error } = await supabase
      .from("calendar_memos")
      .select("*")
      .order("created_at", { ascending: true })
    if (error) throw new Error(error.message)
    const memos = (data ?? []).filter((m: Record<string, unknown>) => !m.is_private || m.kakao_id === identifier)
    return NextResponse.json({ memos })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "메모를 불러오지 못했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, isAdmin, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const body = await request.json()
    const { action, ...payload } = body as { action: string; [key: string]: unknown }

    const identifier = getUserIdentifier(user!)
    const userName = getUserName(user!)

    if (action === "delete") {
      const memoId = Number(payload.id)
      if (!memoId) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 })
      const owner = await fetchMemoOwner(memoId)
      if (!owner) return NextResponse.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 })
      if (!canMutateMemo(owner, identifier, userName, isAdmin)) {
        return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
      }
      const { error } = await supabase.from("calendar_memos").delete().eq("id", memoId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true })
    }

    if (action === "update") {
      const memoId = Number(payload.id)
      if (!memoId) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 })
      const owner = await fetchMemoOwner(memoId)
      if (!owner) return NextResponse.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 })
      if (!canMutateMemo(owner, identifier, userName, isAdmin)) {
        return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
      }

      const { content, is_private, color } = payload as {
        content?: string
        is_private?: boolean
        color?: string
      }
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (content !== undefined) {
        updateData.content = content
        updateData.title = String(content).slice(0, 30)
      }
      if (typeof is_private === "boolean") updateData.is_private = is_private
      if (typeof color === "string") updateData.color = color

      const { error } = await supabase.from("calendar_memos").update(updateData).eq("id", memoId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true })
    }

    // insert (화이트리스트 + author/kakao_id는 서버가 강제)
    const { content, date, is_private, color } = payload as {
      content?: string
      date?: string
      is_private?: boolean
      color?: string
    }
    if (!content || !date) {
      return NextResponse.json({ error: "내용과 날짜가 필요합니다." }, { status: 400 })
    }
    if (typeof content !== "string" || content.length > 2000) {
      return NextResponse.json({ error: "내용은 2000자 이하여야 합니다." }, { status: 400 })
    }
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)" }, { status: 400 })
    }
    const insertData = {
      content,
      date,
      is_private: !!is_private,
      color: typeof color === "string" ? color : null,
      kakao_id: is_private ? identifier : null,
      author: userName,
      title: String(content).slice(0, 30),
    }
    const { error } = await supabase.from("calendar_memos").insert(insertData)
    if (error) throw new Error(error.message)
    sendTelegramMessage(`📅 캘린더 메모 추가\n내용: ${String(content).slice(0, 50)}\n날짜: ${date}`).catch(console.error)
    logActivity(resolveUserEmail(user!), "calendar_memo", { content: String(content).slice(0, 50), date }, getIp(request))
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "저장에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}