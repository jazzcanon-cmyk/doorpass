import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAuth, canEditBuilding } from "@/lib/auth"
import { encryptPassword } from "@/lib/encryption"
import { sendTelegramMessage } from "@/lib/telegram"

const supabase = supabaseAdmin

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  if (!(await canEditBuilding(user!.email))) {
    return NextResponse.json(
      { error: "건물 정보 수정 권한이 없습니다. 설정에서 편집자 권한을 요청하세요." },
      { status: 403 }
    )
  }

  try {
    const { buildingId, name, password, memo } = await request.json()

    if (!buildingId) {
      return NextResponse.json({ error: "buildingId는 필수입니다." }, { status: 400 })
    }

    const updateData: Record<string, string | null> = {}
    if (name !== undefined) updateData.name = name
    if (password !== undefined) {
      const isEmpty = !password || password.trim() === ''
      updateData.password = null
      updateData.password_encrypted = isEmpty ? null : encryptPassword(password)
    }
    if (memo !== undefined) updateData.memo = memo

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 })
    }

    const { error } = await supabase
      .from("buildings")
      .update(updateData)
      .eq("id", Number(buildingId))

    if (error) throw new Error(error.message)

    sendTelegramMessage(`✏️ 건물 정보 수정\n건물 ID: ${String(buildingId)}`).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[buildings/update] 수정 실패:", (error as Error).message)
    return NextResponse.json({ error: "업데이트에 실패했습니다." }, { status: 500 })
  }
}
