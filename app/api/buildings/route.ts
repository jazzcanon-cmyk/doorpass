import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { getBuildingsListAuth, requireAdminApi } from "@/lib/auth"
import { encryptPassword, decryptPassword, isValidEncryptedPassword } from "@/lib/encryption"
import { logActivity, getIp } from "@/lib/activity-logger"

interface BuildingRow {
  id: number
  name: string | null
  address: string | null
  password: string | null
  lat: number
  lng: number
  memo: string | null
}

const supabase = supabaseAdmin

const MASKED_PASSWORD = "●●●●"

function toBuilding(b: BuildingRow, revealPassword: boolean) {
  let password = MASKED_PASSWORD
  if (revealPassword) {
    const rawPassword = b.password ?? ""
    password = rawPassword
    try {
      if (rawPassword && isValidEncryptedPassword(rawPassword)) {
        password = decryptPassword(rawPassword)
      }
    } catch {
      password = rawPassword
    }
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
  const { revealPasswords, unauthorized, userForLog } = await getBuildingsListAuth()
  if (unauthorized) return unauthorized

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
      if (userForLog) {
        logActivity(userForLog, "building_view", { count: data?.length ?? 0 }, getIp(request))
      }
      return NextResponse.json({
        buildings: (data ?? []).map((row) => toBuilding(row, revealPasswords)),
      })
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

    return NextResponse.json({
      buildings: allBuildings.map((row) => toBuilding(row, revealPasswords)),
    })
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

    sendTelegramMessage(
      `🏠 새로운 건물이 등록되었습니다!\n건물명: ${name || address?.split(" ").slice(-1)[0] || "-"}\n주소: ${address || "-"}${memo ? `\n메모: ${memo}` : ""}`,
      "comment_notification"
    ).catch(console.error)

    return NextResponse.json({ building: data }, { status: 201 })
  } catch (error) {
    console.error("Error creating building:", error)
    return NextResponse.json({ error: "건물 등록에 실패했습니다." }, { status: 500 })
  }
}
