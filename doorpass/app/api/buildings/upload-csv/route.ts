import { NextResponse } from "next/server"
import { requireAuth, canUploadCSV } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { encryptPassword } from "@/lib/encryption"
import { generalLimiter, checkRateLimit, rateLimitIdentifier } from "@/lib/ratelimit"

const supabase = supabaseAdmin
const MAX_BATCH = 200

interface IncomingBuilding {
  name?: string
  address?: string
  password?: string
  memo?: string
  lat?: number | string
  lng?: number | string
  region?: string
  branch_id?: string
  access_type?: string
}

const VALID_ACCESS_TYPES = new Set(["free", "password", "etc"])

function normalizeAccessType(raw: unknown): "free" | "password" | "etc" {
  if (typeof raw !== "string") return "password"
  const v = raw.trim().toLowerCase()
  return VALID_ACCESS_TYPES.has(v) ? (v as "free" | "password" | "etc") : "password"
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

  const rl = await checkRateLimit(generalLimiter, rateLimitIdentifier(user?.email, null))
  if (!rl.success) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
    )
  }

  if (!(await canUploadCSV(user!.email))) {
    return NextResponse.json({ error: "CSV 업로드 권한이 없습니다." }, { status: 403 })
  }

  const { data: approver } = await supabase
    .from("approved_users")
    .select("role, branch_id")
    .eq("email", user!.email)
    .maybeSingle()

  const role = String(approver?.role ?? "")
  if (role !== "admin" && role !== "sub_admin") {
    return NextResponse.json({ error: "CSV 업로드 권한이 없습니다." }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    buildings?: IncomingBuilding[]
    batchInfo?: BatchInfo
    isLastBatch?: boolean
  }
  const { buildings, batchInfo, isLastBatch } = body

  if (!Array.isArray(buildings) || buildings.length === 0) {
    return NextResponse.json({ error: "buildings 배열이 필요합니다." }, { status: 400 })
  }
  if (buildings.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `한 번에 ${MAX_BATCH}개까지만 업로드 가능합니다.` },
      { status: 400 }
    )
  }

  const displayNameFromAddress = (address: string) => {
    const t = address.trim()
    if (!t) return ""
    const parts = t.split(/\s+/).filter(Boolean)
    return parts[parts.length - 1] ?? t
  }

  // 검증 + 정규화 (필수: 주소·위도·경도 / 건물명·비밀번호·메모는 선택)
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i]
    const address = String(b.address ?? "").trim()
    const latRaw = typeof b.lat === "string" ? parseFloat(b.lat) : b.lat
    const lngRaw = typeof b.lng === "string" ? parseFloat(b.lng) : b.lng
    const lat = Number(latRaw)
    const lng = Number(lngRaw)

    if (!address) {
      return NextResponse.json(
        { error: `행 ${i + 1}: 주소가 비어 있습니다.` },
        { status: 400 }
      )
    }
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat === 0 ||
      lng === 0
    ) {
      return NextResponse.json(
        { error: `행 ${i + 1}: 위도 또는 경도가 비어 있거나 잘못되었습니다.` },
        { status: 400 }
      )
    }

    const rawName = b.name != null ? String(b.name).trim() : ""
    const name = rawName || displayNameFromAddress(address) || address

    const pwd = b.password != null ? String(b.password).trim() : ""
    const accessType = normalizeAccessType(b.access_type)

    // 라벨은 access_type으로 표현 → password 컬럼은 null
    // password 타입 입력값은 암호화하여 password_encrypted에만 저장
    const encryptedPassword =
      accessType === "free" || accessType === "etc"
        ? null
        : pwd
        ? encryptPassword(pwd)
        : null

    rows.push({
      name,
      address,
      password: null,
      password_encrypted: encryptedPassword,
      memo: b.memo != null && String(b.memo).trim() ? String(b.memo).trim() : null,
      lat,
      lng,
      region: b.region ? String(b.region).trim() : null,
      branch_id: approver?.branch_id ?? null,
      uploaded_by: user!.email,
      access_type: accessType,
    })
  }

  const { data, error } = await supabase
    .from("buildings")
    .insert(rows)
    .select("id")

  if (error) {
    console.error("[buildings/upload-csv] Insert 실패:", (error as Error).message)
    return NextResponse.json({ error: "DB 삽입 실패: " + error.message }, { status: 500 })
  }

  if (batchInfo?.isLastBatch || isLastBatch) {
    sendTelegramMessage(
      `📁 [DoorPass] 건물 일괄 업로드 완료\n\n👤 업로더: ${user!.email}\n🏢 대리점: ${approver?.branch_id ?? "-"}\n📊 건물 수: ${batchInfo?.totalCount ?? data?.length ?? 0}개\n📅 시간: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
      "comment_notification"
    ).catch(console.error)
  }

  return NextResponse.json({
    success: true,
    inserted: data?.length ?? 0,
    message: `${data?.length ?? 0}개 건물이 등록되었습니다.`,
  })
}
