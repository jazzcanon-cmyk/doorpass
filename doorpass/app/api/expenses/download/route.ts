import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { createClient } from "@supabase/supabase-js"

// 서비스 롤 키로 RLS 우회
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Expense {
  id: string
  receipt_date: string
  amount: number
  vendor_name: string | null
  category: string
  is_deductible: boolean
  is_expense: boolean | null
  memo: string | null
  import_source: string | null   // "ocr" | "manual" | "statement"
  business_number: string | null // 10자리 숫자 (국세청 조회 또는 OCR 추출)
}

// 10자리 숫자 → 000-00-00000 형식
function formatBizNo(raw: string | null): string {
  if (!raw) return ""
  const digits = raw.replace(/-/g, "")
  if (digits.length !== 10) return raw
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

// import_source → 증빙유형
function toEvidenceType(source: string | null): string {
  if (source === "ocr" || source === "statement") return "신용카드매출전표"
  return "간이영수증" // manual 및 기타
}

// category → 계정과목
function toAccount(category: string): string {
  const map: Record<string, string> = {
    유류비: "차량유지비(연료비)",
    수리비: "차량유지비(수리비)",
    통신비: "통신비",
    식비:   "복리후생비(식대)",
    기타:   "소모품비",
  }
  return map[category] ?? "소모품비"
}

// period 값별 날짜 범위 계산
function getDateRange(year: string, period: string): { startDate: string; endDate: string } {
  const lastDay = (month: number) =>
    new Date(Number(year), month, 0).toISOString().split("T")[0]

  const fixed: Record<string, { startDate: string; endDate: string }> = {
    all: { startDate: `${year}-01-01`, endDate: `${year}-12-31` },
    q1:  { startDate: `${year}-01-01`, endDate: lastDay(3) },
    q2:  { startDate: `${year}-04-01`, endDate: lastDay(6) },
    q3:  { startDate: `${year}-07-01`, endDate: lastDay(9) },
    q4:  { startDate: `${year}-10-01`, endDate: `${year}-12-31` },
    h1:  { startDate: `${year}-01-01`, endDate: lastDay(6) },
    h2:  { startDate: `${year}-07-01`, endDate: `${year}-12-31` },
  }

  if (fixed[period]) return fixed[period]

  const m = Number(period)
  if (m >= 1 && m <= 12) {
    const mm = String(m).padStart(2, "0")
    return { startDate: `${year}-${mm}-01`, endDate: lastDay(m) }
  }

  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
}

// period 값 → 파일명 라벨
function getPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    all: "전체", q1: "1분기", q2: "2분기",
    q3: "3분기", q4: "4분기", h1: "상반기", h2: "하반기",
  }
  if (labels[period]) return labels[period]
  const m = Number(period)
  if (m >= 1 && m <= 12) return `${m}월`
  return "전체"
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("user_id")
    const year   = searchParams.get("year") ?? String(new Date().getFullYear())
    const period = searchParams.get("period") ?? "all"

    if (!userId) {
      return NextResponse.json({ error: "user_id 필수" }, { status: 400 })
    }

    const { startDate, endDate } = getDateRange(year, period)

    const { data, error } = await supabaseAdmin
      .from("expenses")
      .select(
        "id, receipt_date, amount, vendor_name, category, is_deductible, is_expense, memo, import_source, business_number"
      )
      .eq("user_id", userId)
      .gte("receipt_date", startDate)
      .lte("receipt_date", endDate)
      .order("receipt_date", { ascending: true })

    if (error) throw error

    const rows = (data ?? []) as Expense[]

    if (rows.length === 0) {
      return NextResponse.json({ error: "데이터 없음" }, { status: 404 })
    }

    // 엑셀 시트 데이터 구성
    const sheetData: (string | number)[][] = []

    // 헤더 행 (12컬럼)
    sheetData.push([
      "번호", "날짜", "업체명", "사업자번호", "증빙유형", "계정과목",
      "공급가액", "부가세", "합계", "부가세공제", "경비처리", "비고",
    ])

    // 데이터 행
    let totalSupply = 0
    let totalVat    = 0
    let totalAmount = 0

    rows.forEach((row, idx) => {
      const supply = Math.round((row.amount ?? 0) / 1.1)
      const vat    = (row.amount ?? 0) - supply

      totalSupply += supply
      totalVat    += vat
      totalAmount += row.amount ?? 0

      sheetData.push([
        idx + 1,
        row.receipt_date,
        row.vendor_name ?? "",
        formatBizNo(row.business_number),
        toEvidenceType(row.import_source),
        toAccount(row.category),
        supply,
        vat,
        row.amount ?? 0,
        row.is_deductible ? "가능" : "불가",
        row.is_expense !== false ? "가능" : "불가",
        row.memo ?? "",
      ])
    })

    // 합계 행
    sheetData.push([
      "합계", "", "", "", "", "",
      totalSupply, totalVat, totalAmount,
      "", "", "",
    ])

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(sheetData)

    // 헤더 / 합계 행 굵게 처리
    const headerRange = XLSX.utils.decode_range(ws["!ref"] ?? "A1")
    const lastRow = sheetData.length - 1
    for (const rowIdx of [0, lastRow]) {
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddr = XLSX.utils.encode_cell({ r: rowIdx, c: col })
        if (!ws[cellAddr]) continue
        ws[cellAddr].s = { font: { bold: true } }
      }
    }

    // 컬럼 너비 자동 조정 (한글 1자 = 2칸)
    const colWidths = sheetData[0].map((_, colIdx) =>
      Math.max(
        ...sheetData.map((row) => {
          const val = row[colIdx]
          const str = val === null || val === undefined ? "" : String(val)
          return [...str].reduce((w, ch) => w + (/[가-힣]/.test(ch) ? 2 : 1), 0)
        }),
        4
      )
    )
    ws["!cols"] = colWidths.map((w) => ({ wch: w + 2 }))

    XLSX.utils.book_append_sheet(wb, ws, "지출내역")

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer

    const periodLabel = getPeriodLabel(period)
    const filename    = encodeURIComponent(`지출내역_${year}년_${periodLabel}.xlsx`)

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      },
    })
  } catch (err) {
    console.error("엑셀 다운로드 오류:", err)
    return NextResponse.json({ error: "엑셀 생성 중 오류 발생" }, { status: 500 })
  }
}
