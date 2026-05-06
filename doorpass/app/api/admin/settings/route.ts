import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

const supabase = supabaseAdmin

const ALLOWED_KEYS = new Set([
  "new_user_notification",
  "card_notification",
  "comment_notification",
  "new_signup_notification",
])

export async function GET() {
  try {
    const { unauthorized } = await requireAdminApi()
    if (unauthorized) return unauthorized

    const { data, error } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .order("setting_key")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const settings: Record<string, boolean> = {}
    for (const row of data ?? []) {
      settings[row.setting_key as string] = !!row.setting_value
    }
    return NextResponse.json({ settings })
  } catch (error) {
    console.error("[settings:get] 오류:", (error as Error).message)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { user, unauthorized } = await requireAdminApi()
    if (unauthorized) return unauthorized

    const body = (await request.json().catch(() => ({}))) as {
      setting_key?: string
      setting_value?: unknown
    }
    const { setting_key, setting_value } = body

    if (!setting_key || typeof setting_value !== "boolean") {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
    }
    if (!ALLOWED_KEYS.has(setting_key)) {
      return NextResponse.json({ error: "Invalid setting key" }, { status: 400 })
    }

    // upsert: row가 없을 경우에도 안전하게 저장
    const { error } = await supabase
      .from("admin_settings")
      .upsert(
        {
          setting_key,
          setting_value,
          updated_at: new Date().toISOString(),
          updated_by: user!.email ?? null,
        },
        { onConflict: "setting_key" }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, message: "설정이 저장되었습니다." })
  } catch (error) {
    console.error("[settings:update] 오류:", (error as Error).message)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
