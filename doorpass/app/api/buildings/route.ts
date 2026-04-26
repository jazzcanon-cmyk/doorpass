import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendSlackMessage } from "@/lib/slack"
import { requireAdminApi } from "@/lib/auth"
import { encryptPassword, decryptPassword, isValidEncryptedPassword } from "@/lib/encryption"

interface BuildingRow {
  id: number
  name: string | null
  address: string | null
  password: string | null
  lat: number
  lng: number
  memo: string | null
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function toBuilding(b: BuildingRow) {
  const rawPassword = b.password ?? ""
  let password = rawPassword
  try {
    if (rawPassword && isValidEncryptedPassword(rawPassword)) {
      password = decryptPassword(rawPassword)
    }
  } catch {
    password = rawPassword
  }
  return {
    id: String(b.id),
    name: b.name ?? b.address?.split(" ").slice(-1)[0] ?? "",
    address: b.address ?? "",
    password,
    latitude: b.lat,
    longitude: b.lng,
    memo: b.memo ?? "",
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const minLat = searchParams.get("minLat")
  const maxLat = searchParams.get("maxLat")
  const minLng = searchParams.get("minLng")
  const maxLng = searchParams.get("maxLng")

  try {
    // 뷰포트 범위가 주어지면 단일 필터 쿼리로 처리
    if (minLat && maxLat && minLng && maxLng) {
      const { data, error } = await supabase
        .from("buildings")
        .select("id, name, address, password, lat, lng, memo")
        .gte("lat", parseFloat(minLat))
        .lte("lat", parseFloat(maxLat))
        .gte("lng", parseFloat(minLng))
        .lte("lng", parseFloat(maxLng))
        .order("address", { ascending: true })

      if (error) throw new Error(error.message)
      return NextResponse.json({ buildings: (data ?? []).map(toBuilding) })
    }

    // 전체 로드 (검색/목록용) — 페이지네이션
    let allBuildings: BuildingRow[] = []
    let from = 0
    const pageSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from("buildings")
        .select("id, name, address, password, lat, lng, memo")
        .order("address", { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break

      allBuildings = allBuildings.concat(data)
      if (data.length < pageSize) break
      from += pageSize
    }

    return NextResponse.json({ buildings: allBuildings.map(toBuilding) })
  } catch (error) {
    console.error("Error fetching buildings:", error)
    return NextResponse.json(
      { error: "Failed to fetch building data" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const { name, address, password, lat, lng, memo } = await request.json()

    if (!address) {
      return NextResponse.json({ error: "address는 필수입니다." }, { status: 400 })
    }

    if (lat !== undefined && lng !== undefined) {
      const latNum = Number(lat)
      const lngNum = Number(lng)
      if (
        isNaN(latNum) || isNaN(lngNum) ||
        latNum < 33.0 || latNum > 38.6 ||
        lngNum < 124.6 || lngNum > 131.9
      ) {
        return NextResponse.json({ error: "유효하지 않은 좌표입니다. (한국 범위: 위도 33~38.6, 경도 124.6~131.9)" }, { status: 400 })
      }
    }

    const { data, error } = await supabase
      .from("buildings")
      .insert({ name, address, password: password ? encryptPassword(password) : null, lat, lng, memo })
      .select()
      .single()

    if (error) throw new Error(error.message)

    await sendSlackMessage({
      text: "🏠 새로운 건물이 등록되었습니다!",
      color: "#36a64f",
      fields: [
        { title: "건물명", value: name || address?.split(" ").slice(-1)[0] || "-" },
        { title: "주소", value: address || "-", short: false },
        ...(memo ? [{ title: "메모", value: memo, short: false }] : []),
      ],
    })

    return NextResponse.json({ building: data }, { status: 201 })
  } catch (error) {
    console.error("Error creating building:", error)
    return NextResponse.json({ error: "건물 등록에 실패했습니다." }, { status: 500 })
  }
}
