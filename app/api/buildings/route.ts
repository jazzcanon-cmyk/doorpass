import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendSlackMessage } from "@/lib/slack"
import { requireAdminApi } from "@/lib/auth"

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

export async function GET() {
  try {
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

    const buildings = allBuildings.map((b) => ({
      id: String(b.id),
      name: b.name ?? b.address?.split(" ").slice(-1)[0] ?? "",
      address: b.address ?? "",
      password: b.password ?? "",
      latitude: b.lat,
      longitude: b.lng,
      memo: b.memo ?? "",
    }))

    return NextResponse.json({ buildings })
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
      .insert({ name, address, password, lat, lng, memo })
      .select()
      .single()

    if (error) throw new Error(error.message)

    await sendSlackMessage("🏠 새로운 건물이 등록되었습니다!")

    return NextResponse.json({ building: data }, { status: 201 })
  } catch (error) {
    console.error("Error creating building:", error)
    return NextResponse.json({ error: "건물 등록에 실패했습니다." }, { status: 500 })
  }
}
