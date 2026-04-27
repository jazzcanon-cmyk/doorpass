import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendSlackMessage } from "@/lib/slack"

const supabase = supabaseAdmin

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("notices")
      .select("*")
      .order("is_important", { ascending: false })
      .order("created_at", { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json({ notices: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "공지사항을 불러오지 못했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, ...payload } = body as { action?: string; [key: string]: unknown }

    if (action === "delete") {
      const { error } = await supabase.from("notices").delete().eq("id", payload.id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true })
    }

    const { error } = await supabase.from("notices").insert(payload)
    if (error) throw new Error(error.message)
    sendSlackMessage({ text: "📣 새 공지사항", color: "#f59e0b", fields: [{ title: "제목", value: String((payload as { title?: string }).title || "공지"), short: false }] }).catch(console.error)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "처리에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
