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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("user_id")
    const year = searchParams.get("year") ?? String(new Date().getFullYear())
    const month = searchParams.get("month") // 없으면 전체

    if (!userId) {
      return NextResponse.json({ error: "user_id 필수" }, { status: 400 })
    }

    // 날짜 범위 계산
    const startDate = month
      ? `${year}-${String(month).padStart(2, "0")}-01`
      : `${year}-01-01`
    const endDate = month
      ? new Date(Number(year), Number(month), 0).toISOString().split("T")[0] // 해당 월 마지막 날
      : `${year}-12-31`

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
    sheetData.push([
      "합계",
      "",
      "",
      totalAmount,
      "",
      deductibleAmount,
      "",
      "",
    ])

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

    // 컬럼 너비 자동 조정 (각 열의 최대 글자 수 기준)
    const colWidths = sheetData[0].map((_, colIdx) =>
      Math.max(
        ...sheetData.map((row) => {
          const val = row[colIdx]
          const str = val === null || val === undefined ? "" : String(val)
          // 한글은 2칸으로 계산
          return [...str].reduce((w, ch) => w + (/[가-힣]/.test(ch) ? 2 : 1), 0)
        }),
        4 // 최소 너비
      )
    )
    ws["!cols"] = colWidths.map((w) => ({ wch: w + 2 }))

    XLSX.utils.book_append_sheet(wb, ws, "지출내역")

    // 버퍼로 변환
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer

    // 파일명: 지출내역_2026년.xlsx 또는 지출내역_2026년_3월.xlsx
    const monthSuffix = month ? `_${month}월` : ""
    const filename = encodeURIComponent(`지출내역_${year}년${monthSuffix}.xlsx`)

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
