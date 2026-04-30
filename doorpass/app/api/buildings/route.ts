import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { requireAdminApi, requireAuth } from "@/lib/auth"
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

const MANAGEMENT_PAGE_SIZE = 100

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

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
  const { user, unauthorized } = await requireAuth()
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
      logActivity(user!.email!, "building_view", { count: data?.length ?? 0 }, getIp(request))
      return NextResponse.json({ buildings: (data ?? []).map(toBuilding) })
    }

    const hasPageParam = searchParams.has("page")
    const hasSearchParam = searchParams.has("search")
    const wantsManagementList = hasPageParam || hasSearchParam

    if (wantsManagementList) {
      const pageNum = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
      const searchTerm = (searchParams.get("search") ?? "").trim().replace(/,/g, " ")
      const from = (pageNum - 1) * MANAGEMENT_PAGE_SIZE
      const to = from + MANAGEMENT_PAGE_SIZE - 1

      const { data: me, error: meErr } = await supabaseAdmin
        .from("approved_users")
        .select("role, branch_id")
        .eq("email", user!.email)
        .maybeSingle()

      if (meErr) throw new Error(meErr.message)
      if (!me || (me.role !== "admin" && me.role !== "sub_admin")) {
        return NextResponse.json({ error: "권한 없음" }, { status: 403 })
      }

      if (me.role === "sub_admin" && !me.branch_id) {
        return NextResponse.json({
          buildings: [],
          total: 0,
          page: pageNum,
          pageSize: MANAGEMENT_PAGE_SIZE,
        })
      }

      let q = supabase
        .from("buildings")
        .select("id, name, address, region, created_at", { count: "exact" })

      if (me.role === "sub_admin") {
        q = q.eq("branch_id", me.branch_id as string)
      }

      if (searchTerm) {
        const esc = escapeIlikePattern(searchTerm).replace(/"/g, "")
        const pattern = `%${esc}%`
        const quoted = `"${pattern}"`
        q = q.or(`name.ilike.${quoted},address.ilike.${quoted}`)
      }

      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(from, to)

      if (error) throw new Error(error.message)

      const rows = (data ?? []) as {
        id: number
        name: string | null
        address: string | null
        region: string | null
        created_at: string
      }[]

      return NextResponse.json({
        buildings: rows.map((b) => ({
          id: b.id,
          name: b.name || b.address || "이름 없음",
          address: b.address || "",
          region: b.region ?? null,
          created_at: b.created_at,
        })),
        total: count ?? 0,
        page: pageNum,
        pageSize: MANAGEMENT_PAGE_SIZE,
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
