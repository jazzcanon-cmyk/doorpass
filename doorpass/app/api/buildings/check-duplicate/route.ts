import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAuth } from "@/lib/auth"
import { normalizeAddress, extractRoadAddress } from "@/lib/geo-utils"

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

export async function GET(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const address = searchParams.get("address")?.trim()

  if (!address) {
    return NextResponse.json({ error: "address 파라미터가 필요합니다." }, { status: 400 })
  }

  const normalizedInput = normalizeAddress(address)
  const roadPart = extractRoadAddress(address)
  const searchKey = roadPart || normalizedInput
  const pattern = `%${escapeIlikePattern(searchKey)}%`

  const { data, error } = await supabaseAdmin
    .from("buildings")
    .select("id, name, address, created_at")
    .ilike("address", pattern)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 정규화된 형태로 한 번 더 비교 (광역시/특별시 표기 차이 흡수)
  const match = (data ?? []).find((row) => {
    const dbAddr = (row as { address: string | null }).address ?? ""
    const dbNorm = normalizeAddress(dbAddr)
    const dbRoad = extractRoadAddress(dbAddr)
    return (
      dbNorm === normalizedInput ||
      (roadPart && dbRoad === roadPart) ||
      dbNorm.includes(searchKey) ||
      normalizedInput.includes(dbRoad)
    )
  }) ?? data?.[0]

  if (match) {
    const b = match as { id: number; name: string | null; address: string | null; created_at: string }
    return NextResponse.json({
      exists: true,
      building: {
        id: String(b.id),
        name: b.name || b.address || "이름 없음",
        address: b.address || "",
        created_at: b.created_at,
      },
    })
  }

  return NextResponse.json({ exists: false })
}
