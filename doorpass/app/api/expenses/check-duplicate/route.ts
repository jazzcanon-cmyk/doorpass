import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAuth } from "@/lib/auth"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const body = (await req.json()) as { user_id: string; image_hash: string }
    const { user_id, image_hash } = body

    if (!user_id || !image_hash) {
      return NextResponse.json({ error: "user_id, image_hash 필수" }, { status: 400 })
    }

    // 같은 user_id + image_hash가 있으면 중복
    const { data } = await supabaseAdmin
      .from("expenses")
      .select("vendor_name, receipt_date, amount")
      .eq("user_id", user_id)
      .eq("image_hash", image_hash)
      .maybeSingle()

    if (data) {
      return NextResponse.json({ isDuplicate: true, existing: data })
    }
    return NextResponse.json({ isDuplicate: false })
  } catch (err) {
    console.error("중복 확인 오류:", err)
    return NextResponse.json({ error: "중복 확인 중 오류" }, { status: 500 })
  }
}
