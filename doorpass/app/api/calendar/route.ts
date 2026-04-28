import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { requireAuth } from "@/lib/auth"
import { logActivity, getIp } from "@/lib/activity-logger"

const supabase = supabaseAdmin

export async function GET() {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const { data, error } = await supabase
      .from("calendar_memos")
      .select("*")
      .order("created_at", { ascending: true })
    if (error) throw new Error(error.message)
    return NextResponse.json({ memos: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "메모를 불러오지 못했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const body = await request.json()
    const { action, ...payload } = body as { action: string; [key: string]: unknown }

    if (action === "delete") {
      const { error } = await supabase
        .from("calendar_memos")
        .delete()
        .eq("id", payload.id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true })
    }

    if (action === "update") {
      const { id, content, ...rest } = payload as { id: number; content?: string; [key: string]: unknown }
      const updateData: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() }
      if (content !== undefined) {
        updateData.content = content
        updateData.title = String(content).slice(0, 30)
      }
      const { error } = await supabase.from("calendar_memos").update(updateData).eq("id", id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true })
    }

    // insert
    const { content: insertContent, ...insertRest } = payload as { content?: string; [key: string]: unknown }
    const insertData = { ...insertRest, content: insertContent, title: String(insertContent ?? "").slice(0, 30) }
    const { error } = await supabase.from("calendar_memos").insert(insertData)
    if (error) throw new Error(error.message)
    sendTelegramMessage(`📅 캘린더 메모 추가\n내용: ${String(insertContent || "").slice(0, 50)}\n날짜: ${String(insertRest.date || "")}`).catch(console.error)
    logActivity(user!.email!, "calendar_memo", { content: String(insertContent || "").slice(0, 50), date: String(insertRest.date || "") }, getIp(request))
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "저장에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}