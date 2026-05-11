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
  memo: string | null
}

// period 값별 날짜 범위 계산
function getDateRange(year: string, period: string): { startDate: string; endDate: string } {
  // 해당 연도의 N월 마지막 날 계산 (month: 1-based)
  const lastDay = (month: number) =>
    new Date(Number(year), month, 0).toISOString().split("T")[0]

  const fixed: Record<string, { startDate: string; endDate: string }> = {
    all: { startDate: `${year}-01-01`, endDate: `${year}-12-31` },
    q1:  { startDate: `${year}-01-01`, endDate: lastDay(3) },   // 1~3월
    q2:  { startDate: `${year}-04-01`, endDate: lastDay(6) },   // 4~6월
    q3:  { startDate: `${year}-07-01`, endDate: lastDay(9) },   // 7~9월
    q4:  { startDate: `${year}-10-01`, endDate: `${year}-12-31` }, // 10~12월
    h1:  { startDate: `${year}-01-01`, endDate: lastDay(6) },   // 상반기 1~6월
    h2:  { startDate: `${year}-07-01`, endDate: `${year}-12-31` }, // 하반기 7~12월
  }

  if (fixed[period]) return fixed[period]

  // 숫자(1~12)이면 해당 월 1일 ~ 말일
  const m = Number(period)
  if (m >= 1 && m <= 12) {
    const mm = String(m).padStart(2, "0")
    return { startDate: `${year}-${mm}-01`, endDate: lastDay(m) }
  }

  // 알 수 없는 값이면 전체 연도
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
}

// period 값 → 파일명에 쓸 한국어 라벨
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
    const period = searchParams.get("period") ?? "all" // 기간 옵션 (month 파라미터 대체)

    if (!userId) {
      return NextResponse.json({ error: "user_id 필수" }, { status: 400 })
    }

    const { startDate, endDate } = getDateRange(year, period)

    // expenses 조회
    const { data, error } = await supabaseAdmin
      .from("expenses")
      .select("id, receipt_date, amount, vendor_name, category, is_deductible, memo")
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

    // 헤더 행
    sheetData.push(["번호", "날짜", "업체명", "금액", "카테고리", "부가세공제", "경비처리", "비고"])

    // 데이터 행
    rows.forEach((row, idx) => {
      sheetData.push([
        idx + 1,
        row.receipt_date,
        row.vendor_name ?? "",
        row.amount ?? 0,
        row.category,
        row.is_deductible ? "가능" : "불가",
        "가능",
        row.memo ?? "",
      ])
    })

    // 합계 행
    const totalAmount = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0)
    const deductibleAmount = rows
      .filter((r) => r.is_deductible)
      .reduce((sum, r) => sum + (r.amount ?? 0), 0)
    sheetData.push(["합계", "", "", totalAmount, "", deductibleAmount, "", ""])

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(sheetData)

    // 헤더 행 굵게 처리
    const headerRange = XLSX.utils.decode_range(ws["!ref"] ?? "A1")
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!ws[cellAddr]) continue
      ws[cellAddr].s = { font: { bold: true } }
    }

    // 합계 행 굵게 처리
    const lastRow = sheetData.length - 1
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddr = XLSX.utils.encode_cell({ r: lastRow, c: col })
      if (!ws[cellAddr]) continue
      ws[cellAddr].s = { font: { bold: true } }
    }

    // 컬럼 너비 자동 조정 (한글 1자 = 2칸으로 계산)
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

    // 버퍼로 변환
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer

    // 파일명: 지출내역_2026년_1분기.xlsx / 지출내역_2026년_상반기.xlsx / 지출내역_2026년_5월.xlsx
    const periodLabel = getPeriodLabel(period)
    const filename = encodeURIComponent(`지출내역_${year}년_${periodLabel}.xlsx`)

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
