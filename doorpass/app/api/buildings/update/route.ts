import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAuth } from "@/lib/auth"
import { encryptPassword } from "@/lib/encryption"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { buildingId, name, password, memo } = await request.json()

    if (!buildingId) {
      return NextResponse.json({ error: "buildingId는 필수입니다." }, { status: 400 })
    }

    const updateData: Record<string, string> = {}
    if (name !== undefined) updateData.name = name
    if (password !== undefined) updateData.password = encryptPassword(password)
    if (memo !== undefined) updateData.memo = memo

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 })
    }

    const { error } = await supabase
      .from("buildings")
      .update(updateData)
      .eq("id", Number(buildingId))

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating building:", error)
    return NextResponse.json({ error: "업데이트에 실패했습니다." }, { status: 500 })
  }
}
