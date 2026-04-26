import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { createClient } from "@supabase/supabase-js"
import { requireAdminApi } from "@/lib/auth"
import { encryptPassword } from "@/lib/encryption"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
    const wb = XLSX.read(new Uint8Array(buffer), { type: "array" })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]

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
      const name     = String(row[0] ?? "").trim()
      const address  = String(row[1] ?? "").trim()
      const password = String(row[2] ?? "").trim()
      const floor    = String(row[3] ?? "").trim()
      const unit     = String(row[4] ?? "").trim()
      const memoRaw  = String(row[5] ?? "").trim()
      const rowNum   = i + 2

      if (!address) {
        stats.failed++
        errors.push({ row: rowNum, address: address || "(없음)", reason: "주소 누락" })
        continue
      }

      // 층/호 정보를 메모에 포함
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
          .update({ name: buildingName, password: password ? encryptPassword(password) : null, memo })
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
        password: password ? encryptPassword(password) : null,
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

    console.log(`[Import] 완료 — 성공: ${stats.success}, 실패: ${stats.failed}, 건너뜀: ${stats.skipped}`)

    return NextResponse.json({ ...stats, errors })
  } catch (err) {
    console.error("[Import] 오류:", err)
    return NextResponse.json({ error: "파일 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}
