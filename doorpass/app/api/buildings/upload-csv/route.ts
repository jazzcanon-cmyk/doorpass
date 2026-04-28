import { NextResponse } from "next/server"
import { requireAuth, canUploadCSV } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { encryptPassword } from "@/lib/encryption"

const supabase = supabaseAdmin
const MAX_BATCH = 200

interface IncomingBuilding {
  name?: string
  address?: string
  password?: string
  memo?: string
  latitude?: number | string
  longitude?: number | string
  region?: string
}

interface BatchInfo {
  currentBatch?: number
  totalBatches?: number
  isLastBatch?: boolean
  totalCount?: number
}

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  if (!(await canUploadCSV(user!.email))) {
    return NextResponse.json({ error: "CSV 업로드 권한이 없습니다." }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    buildings?: IncomingBuilding[]
    batchInfo?: BatchInfo
  }
  const { buildings, batchInfo } = body

  if (!Array.isArray(buildings) || buildings.length === 0) {
    return NextResponse.json({ error: "buildings 배열이 필요합니다." }, { status: 400 })
  }
  if (buildings.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `한 번에 ${MAX_BATCH}개까지만 업로드 가능합니다.` },
      { status: 400 }
    )
  }

  // 검증 + 정규화
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i]
    const lat = typeof b.latitude === "string" ? parseFloat(b.latitude) : b.latitude
    const lng = typeof b.longitude === "string" ? parseFloat(b.longitude) : b.longitude
    if (!b.name || !b.address || lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) {
      return NextResponse.json(
        {
          error: `행 ${i + 1}: 필수 필드 누락 (건물명, 주소, 위도, 경도)`,
        },
        { status: 400 }
      )
    }
    rows.push({
      name: String(b.name).trim(),
      address: String(b.address).trim(),
      password: b.password ? encryptPassword(String(b.password)) : null,
      memo: b.memo ? String(b.memo).trim() : null,
      lat: Number(lat),
      lng: Number(lng),
      region: b.region ? String(b.region).trim() : null,
      uploaded_by: user!.email,
    })
  }

  const { data, error } = await supabase
    .from("buildings")
    .insert(rows)
    .select("id")

  if (error) {
    console.error("[CSV Upload] Insert error:", error)
    return NextResponse.json({ error: "DB 삽입 실패: " + error.message }, { status: 500 })
  }

  if (batchInfo?.isLastBatch) {
    sendTelegramMessage(
      `📤 건물 CSV 업로드 완료\n👤 ${user!.email}\n📊 총 ${batchInfo.totalCount ?? data?.length ?? 0}개 건물 업로드`,
      "comment_notification"
    ).catch(console.error)
  }

  return NextResponse.json({
    success: true,
    inserted: data?.length ?? 0,
    message: `${data?.length ?? 0}개 건물이 등록되었습니다.`,
  })
}
