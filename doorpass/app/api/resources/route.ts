import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Supabase 환경변수가 설정되지 않았습니다.")
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json({ resources: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "자료를 불러오지 못했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { action, ...payload } = body as { action?: string; [key: string]: unknown }

    if (action === "delete") {
      const { error } = await supabase.from("resources").delete().eq("id", payload.id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true })
    }

    const { error } = await supabase.from("resources").insert(payload)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "처리에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
