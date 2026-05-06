import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAdminApi } from "@/lib/auth"
import { encryptPassword } from "@/lib/encryption"
import { sendTelegramMessage } from "@/lib/telegram"

const supabase = supabaseAdmin

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPS_KEY) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}&language=ko&region=KR`
    const res = await fetch(url)
    const json = await res.json() as { status: string; results: { geometry: { location: { lat: number; lng: number } } }[] }
    if (json.status !== "OK" || !json.results.length) return null
    return json.results[0].geometry.location
  } catch {
    return null
  }
}

function isKoreanCoord(lat: number, lng: number) {
  return lat >= 33.0 && lat <= 38.6 && lng >= 124.6 && lng <= 131.9
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

interface ImportError { row: number; address: string; reason: string }

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const form = await request.formData()
    const file = form.get("file") as File | null
    const duplicateAction = (form.get("duplicateAction") as string) ?? "skip"

    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    const ws = wb.worksheets[0]
    const allRows: unknown[][] = []
    ws.eachRow((row) => {
      allRows.push((row.values as unknown[]).slice(1))
    })

    // 헤더 파싱: 영문(신규) / 한글(구버전) 모두 지원
    const headerRow = (allRows[0] ?? []) as (string | undefined)[]
    const colIdx = { name: -1, address: -1, password: -1, floor: -1, unit: -1, memo: -1 }
    headerRow.forEach((h, i) => {
      const s = String(h ?? "").trim()
      if (s === "name"     || s === "건물명")   colIdx.name     = i
      if (s === "address"  || s === "주소")     colIdx.address  = i
      if (s === "password" || s === "비밀번호") colIdx.password = i
      if (s === "floors"   || s === "층수")     colIdx.floor    = i
      if (s === "unit"     || s === "호수")     colIdx.unit     = i
      if (s === "memo"     || s === "메모")     colIdx.memo     = i
    })
    // 인식된 헤더가 없으면 기존 위치 기반으로 폴백
    if (colIdx.name === -1 && colIdx.address === -1) {
      Object.assign(colIdx, { name: 0, address: 1, password: 2, floor: 3, unit: 4, memo: 5 })
    }

    // 헤더 제외, 빈 행 필터
    const dataRows = allRows.slice(1).filter(row =>
      Array.isArray(row) && row.some(c => c !== "" && c !== undefined && c !== null)
    )

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "데이터 행이 없습니다." }, { status: 400 })
    }
    if (dataRows.length > 200) {
      return NextResponse.json({ error: "한 번에 최대 200행까지 등록 가능합니다." }, { status: 400 })
    }

    // 기존 주소 목록을 한 번에 조회 (중복 체크용)
    const { data: existingData } = await supabase
      .from("buildings")
      .select("id, address")
    const existingMap = new Map<string, number>(
      (existingData ?? []).map(b => [b.address ?? "", Number(b.id)])
    )

    const stats = { total: dataRows.length, success: 0, updated: 0, skipped: 0, failed: 0 }
    const errors: ImportError[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as (string | number | undefined)[]
      const get = (idx: number) => (idx >= 0 ? String(row[idx] ?? "") : "").trim()
      const name     = get(colIdx.name)
      const address  = get(colIdx.address)
      const password = get(colIdx.password)
      const floor    = get(colIdx.floor)
      const unit     = get(colIdx.unit)
      const memoRaw  = get(colIdx.memo)
      const rowNum   = i + 2

      if (!address) {
        stats.failed++
        errors.push({ row: rowNum, address: address || "(없음)", reason: "주소 누락" })
        continue
      }

      // 층/호 정보가 있으면 메모에 포함 (구버전 호환)
      const floorUnit = [floor && `${floor}층`, unit && `${unit}호`].filter(Boolean).join(" ")
      const memo = [floorUnit, memoRaw].filter(Boolean).join(" / ")

      const buildingName = name || address.split(" ").slice(-1)[0] || address

      // 중복 체크
      const existingId = existingMap.get(address)
      if (existingId !== undefined) {
        if (duplicateAction === "skip") {
          stats.skipped++
          continue
        }
        // update
        const { error } = await supabase
          .from("buildings")
          .update({
            name: buildingName,
            password: null,
            password_encrypted: password ? encryptPassword(password) : null,
            memo,
          })
          .eq("id", existingId)
        if (error) {
          stats.failed++
          errors.push({ row: rowNum, address, reason: `업데이트 오류: ${error.message}` })
        } else {
          stats.updated++
          stats.success++
        }
        continue
      }

      // 좌표 변환
      const coords = await geocode(address)
      if (!coords) {
        stats.failed++
        errors.push({ row: rowNum, address, reason: "주소 좌표 변환 실패 (Google Maps)" })
        continue
      }
      if (!isKoreanCoord(coords.lat, coords.lng)) {
        stats.failed++
        errors.push({ row: rowNum, address, reason: `한국 범위 초과 (${coords.lat}, ${coords.lng})` })
        continue
      }

      // 삽입
      const { error } = await supabase.from("buildings").insert({
        name: buildingName,
        address,
        password: null,
        password_encrypted: password ? encryptPassword(password) : null,
        lat: coords.lat,
        lng: coords.lng,
        memo,
      })

      if (error) {
        stats.failed++
        errors.push({ row: rowNum, address, reason: `DB 오류: ${error.message}` })
      } else {
        stats.success++
        existingMap.set(address, -1) // 중복 방지
      }

      // 10건마다 200ms 대기 (Geocoding 레이트 리밋 방어)
      if ((i + 1) % 10 === 0) await delay(200)
    }

    sendTelegramMessage(`📥 건물 일괄등록\n등록 수: ${stats.success}건`).catch(console.error)

    return NextResponse.json({ ...stats, errors })
  } catch (err) {
    console.error("[buildings/import] 처리 실패:", (err as Error).message)
    return NextResponse.json({ error: "파일 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}
