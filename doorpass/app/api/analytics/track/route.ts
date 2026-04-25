import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { type, data } = await request.json()
    if (!type) return NextResponse.json({ error: "type required" }, { status: 400 })

    const { error } = await supabase.from("user_activities").insert({
      activity_type: type,
      data: data ?? {},
    })

    if (error) {
      console.error("[Analytics] DB insert error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Analytics] track error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
