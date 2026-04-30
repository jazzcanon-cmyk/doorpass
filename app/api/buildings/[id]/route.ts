import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getBuildingsListAuth } from "@/lib/auth"
import { decryptPassword, isValidEncryptedPassword } from "@/lib/encryption"

interface BuildingRow {
  id: number
  name: string | null
  address: string | null
  password: string | null
  lat: number
  lng: number
  memo: string | null
}

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { revealPasswords, unauthorized } = await getBuildingsListAuth()
  if (unauthorized) return unauthorized

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "유효하지 않은 건물 ID입니다." }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from("buildings")
    .select("id, name, address, password, lat, lng, memo")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[buildings/[id]]", error.message)
    return NextResponse.json({ error: "건물 조회에 실패했습니다." }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: "건물을 찾을 수 없습니다." }, { status: 404 })
  }

  return NextResponse.json({ building: toBuilding(data as BuildingRow, revealPasswords) })
}
