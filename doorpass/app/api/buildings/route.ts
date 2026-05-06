import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { requireAuth, canRevealBuildingPassword, getBuildingsListAuth } from "@/lib/auth"
import { encryptPassword, decryptPassword, isValidEncryptedPassword } from "@/lib/encryption"
import { logActivity, getIp } from "@/lib/activity-logger"
import { normalizeAddress } from "@/lib/geo-utils"
import { addPoints } from "@/lib/points"
import { lookupAddress } from "@/lib/address-convert"

interface BuildingRow {
  id: number
  name: string | null
  address: string | null
  password: string | null
  password_encrypted?: string | null
  lat: number
  lng: number
  memo: string | null
  access_type?: "free" | "password" | "etc" | null
}

const supabase = supabaseAdmin

const MANAGEMENT_PAGE_SIZE = 100
const MASKED_BUILDING_PASSWORD = "●●●●"

// 공개 건물 데이터 캐시 (인증 상태별 분리 캐시)
const BUILDING_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
  "Vary": "Cookie",
}

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

// 비승인 사용자에게 노출되는 좌표 정밀도(소수점 2자리, ~1.1km)
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function toBuilding(b: BuildingRow, revealPassword: boolean) {
  const accessType = b.access_type ?? "password"
  const outLat = revealPassword ? b.lat : round2(b.lat)
  const outLng = revealPassword ? b.lng : round2(b.lng)

  // 자유출입은 항상 공개 (미승인자도 표시)
  if (accessType === "free") {
    return {
      id: String(b.id),
      name: b.name ?? b.address?.split(" ").slice(-1)[0] ?? "",
      address: b.address ?? "",
      password: "자유출입",
      lat: outLat,
      lng: outLng,
      memo: revealPassword ? b.memo ?? "" : "",
      access_type: accessType,
    }
  }

  // 기타: 라벨은 항상 공개, 메모는 승인자만
  if (accessType === "etc") {
    return {
      id: String(b.id),
      name: b.name ?? b.address?.split(" ").slice(-1)[0] ?? "",
      address: b.address ?? "",
      password: "메모 참조",
      lat: outLat,
      lng: outLng,
      memo: revealPassword ? b.memo ?? "" : "",
      access_type: accessType,
    }
  }

  // password: 미승인자는 마스킹
  if (!revealPassword) {
    return {
      id: String(b.id),
      name: b.name ?? b.address?.split(" ").slice(-1)[0] ?? "",
      address: b.address ?? "",
      password: MASKED_BUILDING_PASSWORD,
      lat: outLat,
      lng: outLng,
      memo: "",
      access_type: accessType,
    }
  }

  // password_encrypted 우선, 없으면 password 컬럼(레거시 평문 또는 구버전 암호화) fallback
  const encryptedField = b.password_encrypted ?? null
  const rawPassword = b.password ?? ""
  let password = ""
  try {
    if (encryptedField && isValidEncryptedPassword(encryptedField)) {
      password = decryptPassword(encryptedField)
    } else if (rawPassword && isValidEncryptedPassword(rawPassword)) {
      password = decryptPassword(rawPassword)
    } else {
      password = rawPassword
    }
  } catch {
    password = rawPassword
  }
  return {
    id: String(b.id),
    name: b.name ?? b.address?.split(" ").slice(-1)[0] ?? "",
    address: b.address ?? "",
    password,
    lat: b.lat,
    lng: b.lng,
    memo: b.memo ?? "",
    access_type: accessType,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const minLat = searchParams.get("minLat")
  const maxLat = searchParams.get("maxLat")
  const minLng = searchParams.get("minLng")
  const maxLng = searchParams.get("maxLng")
  const latParam = searchParams.get("lat")
  const lngParam = searchParams.get("lng")
  const hasPageParam = searchParams.has("page")
  const hasSearchParam = searchParams.has("search")

  // 내주변 탭: lat/lng 반경 조회는 비로그인도 허용 (비밀번호는 마스킹)
  if (latParam && lngParam && !minLat) {
    try {
      const lat = parseFloat(latParam)
      const lng = parseFloat(lngParam)
      if (!isFinite(lat) || !isFinite(lng)) {
        return NextResponse.json({ buildings: [], usedRadius: 0 }, { headers: BUILDING_CACHE_HEADERS })
      }
      const { revealPasswords } = await getBuildingsListAuth()

      const requestedRadius = Math.max(50, Math.min(500, Number(searchParams.get("radius")) || 100))
      // 결과 0건이면 200m → 500m 순으로 자동 확장
      const expandSteps = [requestedRadius]
      if (requestedRadius < 200) expandSteps.push(200)
      if (requestedRadius < 500) expandSteps.push(500)

      let buildings: BuildingRow[] = []
      let usedRadius = requestedRadius

      for (const r of expandSteps) {
        const latDelta = r / 111000
        const lngDelta = r / (111000 * Math.cos((lat * Math.PI) / 180))
        const { data, error } = await supabase
          .from("buildings")
          .select("id, name, address, password, password_encrypted, lat, lng, memo, access_type")
          .gte("lat", lat - latDelta)
          .lte("lat", lat + latDelta)
          .gte("lng", lng - lngDelta)
          .lte("lng", lng + lngDelta)
          .order("lat", { ascending: true })
          .limit(50)
        if (error) throw new Error(error.message)
        if (data && data.length > 0) {
          buildings = data as BuildingRow[]
          usedRadius = r
          break
        }
      }

      return NextResponse.json(
        { buildings: buildings.map((row) => toBuilding(row, revealPasswords)), usedRadius },
        { headers: BUILDING_CACHE_HEADERS }
      )
    } catch (error) {
      console.error("[buildings:nearby] 조회 실패:", (error as Error).message)
      return NextResponse.json(
        { error: "Failed to fetch nearby buildings" },
        { status: 500 }
      )
    }
  }

  // 검색 단독 호출은 비로그인도 허용 (비밀번호는 마스킹)
  if (hasSearchParam && !hasPageParam) {
    try {
      const { user, revealPasswords } = await getBuildingsListAuth()
      const searchTerm = (searchParams.get("search") ?? "").trim()
      if (!searchTerm) {
        return NextResponse.json({ buildings: [], total: 0 }, { headers: BUILDING_CACHE_HEADERS })
      }

      const makeQuoted = (term: string) => `"%${escapeIlikePattern(term).replace(/"/g, "")}%"`

      // Step 1: 정확한 ilike 검색
      const { data: step1Data, error: step1Error } = await supabase
        .from("buildings")
        .select("id, name, address, password, password_encrypted, lat, lng, memo, access_type")
        .or(`name.ilike.${makeQuoted(searchTerm)},address.ilike.${makeQuoted(searchTerm)}`)
        .order("address", { ascending: true })
        .limit(100)

      if (step1Error) throw new Error(step1Error.message)
      let rows = (step1Data ?? []) as BuildingRow[]
      let searchNote: string | undefined

      // Step 2: 공백 제거 정규화 검색 (0건일 때)
      if (rows.length === 0) {
        const { data: normData } = await supabase.rpc("search_buildings_normalized", {
          search_text: searchTerm,
        })
        if (normData && (normData as BuildingRow[]).length > 0) {
          rows = normData as BuildingRow[]
        }
      }

      // Step 3+4: 카카오 주소 변환 + 다단계 fallback 검색 (여전히 0건일 때)
      if (rows.length === 0) {
        const lookup = await lookupAddress(searchTerm)
        const candidates = [
          lookup.roadCore,
          lookup.roadName,
          lookup.dongName,
          lookup.roadFull,
        ]
          .filter((v): v is string => !!v && v.trim() !== "" && v !== searchTerm)
          .filter((v, i, arr) => arr.indexOf(v) === i)

        for (const cand of candidates) {
          const { data: hit, error: hitErr } = await supabase
            .from("buildings")
            .select("id, name, address, password, password_encrypted, lat, lng, memo, access_type")
            .or(`name.ilike.${makeQuoted(cand)},address.ilike.${makeQuoted(cand)}`)
            .order("address", { ascending: true })
            .limit(100)
          if (hitErr) continue
          if (hit && hit.length > 0) {
            rows = hit as BuildingRow[]
            if (lookup.roadFull) searchNote = `'${searchTerm}' → '${lookup.roadFull}' 로 검색됨`
            break
          }
        }
      }

      if (user?.email) {
        logActivity(
          user.email,
          "search",
          { keyword: searchTerm, count: rows.length, searchNote },
          getIp(request)
        )
      }
      return NextResponse.json(
        { buildings: rows.map((row) => toBuilding(row, revealPasswords)), total: rows.length, searchNote },
        { headers: BUILDING_CACHE_HEADERS }
      )
    } catch (error) {
      console.error("[buildings:search] 검색 실패:", (error as Error).message)
      return NextResponse.json(
        { error: "Failed to fetch building data" },
        { status: 500 }
      )
    }
  }

  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const revealPassword = await canRevealBuildingPassword(user?.email)

    // 뷰포트 범위가 주어지면 단일 필터 쿼리로 처리
    if (minLat && maxLat && minLng && maxLng) {
      const { data, error } = await supabase
        .from("buildings")
        .select("id, name, address, password, password_encrypted, lat, lng, memo, access_type")
        .gte("lat", parseFloat(minLat))
        .lte("lat", parseFloat(maxLat))
        .gte("lng", parseFloat(minLng))
        .lte("lng", parseFloat(maxLng))
        .order("address", { ascending: true })

      if (error) throw new Error(error.message)
      logActivity(user!.email!, "building_view", { count: data?.length ?? 0 }, getIp(request))
      return NextResponse.json({
        buildings: (data ?? []).map((row) => toBuilding(row as BuildingRow, revealPassword)),
      })
    }

    const wantsManagementList = hasPageParam

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
        .select("id, name, address, password, password_encrypted, lat, lng, memo, access_type")
        .order("address", { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break

      allBuildings = allBuildings.concat(data)
      if (data.length < pageSize) break
      from += pageSize
    }

    return NextResponse.json({
      buildings: allBuildings.map((row) => toBuilding(row, revealPassword)),
    })
  } catch (error) {
    console.error("[buildings:list] 조회 실패:", (error as Error).message)
    return NextResponse.json(
      { error: "Failed to fetch building data" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  // 승인된 사용자인지 확인
  const { data: approvedUser } = await supabaseAdmin
    .from("approved_users")
    .select("role, branch_id, name")
    .eq("email", user!.email)
    .maybeSingle()

  if (!approvedUser) {
    return NextResponse.json({ error: "승인된 사용자만 건물을 등록할 수 있습니다." }, { status: 403 })
  }

  try {
    const body = (await request.json()) as {
      name?: string
      address?: string
      password?: string
      lat?: number
      lng?: number
      memo?: string
      region?: string
      branch_id?: string | null
      uploaded_by?: string
      access_type?: "free" | "password" | "etc"
    }
    const { name, address, password, memo, region } = body
    const lat = body.lat
    const lng = body.lng
    const branch_id = body.branch_id ?? approvedUser.branch_id ?? null
    const uploaded_by = body.uploaded_by ?? user!.email
    const access_type = body.access_type ?? "password"

    if (!address?.trim()) {
      return NextResponse.json({ error: "주소는 필수입니다." }, { status: 400 })
    }
    if (access_type === "password" && (!password || password.length < 4)) {
      return NextResponse.json({ error: "비밀번호는 4자리 이상이어야 합니다." }, { status: 400 })
    }

    if (lat !== undefined && lng !== undefined) {
      const latNum = Number(lat)
      const lngNum = Number(lng)
      if (
        isNaN(latNum) || isNaN(lngNum) ||
        latNum < 33.0 || latNum > 38.6 ||
        lngNum < 124.6 || lngNum > 131.9
      ) {
        return NextResponse.json(
          { error: "유효하지 않은 좌표입니다. (한국 범위: 위도 33~38.6, 경도 124.6~131.9)" },
          { status: 400 }
        )
      }
    }

    const normalizedAddress = normalizeAddress(address.trim())

    // 자유출입/기타: 라벨은 access_type으로 표현 → password 컬럼은 null
    // password 타입: 입력값 암호화 → password_encrypted에만 저장
    const encryptedPassword =
      access_type === "free" || access_type === "etc"
        ? null
        : (password && password.trim())
        ? encryptPassword(password)
        : null

    const { data, error } = await supabase
      .from("buildings")
      .insert({
        name: name?.trim() || null,
        address: normalizedAddress,
        password: null,
        password_encrypted: encryptedPassword,
        lat: lat ?? 0,
        lng: lng ?? 0,
        memo: memo?.trim() || null,
        region: region || null,
        branch_id,
        access_type,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    const displayName = name?.trim() || normalizedAddress.split(" ").slice(-1)[0] || "-"
    sendTelegramMessage(
      `🏠 [새 건물 등록]\n건물명: ${displayName}\n주소: ${normalizedAddress}\n등록자: ${uploaded_by ?? "-"}${memo ? `\n메모: ${memo}` : ""}${region ? `\n지역: ${region}` : ""}`,
      "comment_notification"
    ).catch(console.error)

    if (user?.email && ["editor", "sub_admin", "admin"].includes(approvedUser.role ?? "")) {
      addPoints({
        email: user.email,
        action: "building_new",
        buildingId: data?.id,
        buildingName: name,
      }).catch(console.error)
    }

    return NextResponse.json({ building: data }, { status: 201 })
  } catch (error) {
    console.error("[buildings:create] 등록 실패:", (error as Error).message)
    return NextResponse.json({ error: "건물 등록에 실패했습니다." }, { status: 500 })
  }
}
