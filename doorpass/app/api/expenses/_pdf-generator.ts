// 공유 PDF 생성 유틸리티 — pdf/route.ts, email/route.ts에서 import
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── 한국어 폰트 캐시 ────────────────────────────────────────────────────────
// NanumGothic TTF를 GitHub Raw에서 1회 로드 후 인스턴스 메모리에 캐시.
// Vercel 콜드 스타트 시 재로드되나, 웜 인스턴스에서는 즉시 재사용.
let _cachedFontB64: string | null = null

async function loadKoreanFont(): Promise<string | null> {
  if (_cachedFontB64) return _cachedFontB64
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/google/fonts/main/ofl/nanumgothic/NanumGothic-Regular.ttf",
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    _cachedFontB64 = Buffer.from(buf).toString("base64")
    return _cachedFontB64
  } catch {
    // 네트워크 오류 시 기본 폰트(helvetica) 폴백 — 한글이 박스로 표시될 수 있음
    return null
  }
}

// ─── 날짜 범위 + 기간 라벨 계산 ─────────────────────────────────────────────
export function getRange(year: string, period: string) {
  const lastDay = (m: number) =>
    new Date(Number(year), m, 0).toISOString().split("T")[0]

  const fixed: Record<string, { start: string; end: string; label: string }> = {
    all: { start: `${year}-01-01`, end: `${year}-12-31`,      label: "전체"  },
    q1:  { start: `${year}-01-01`, end: lastDay(3),           label: "1분기" },
    q2:  { start: `${year}-04-01`, end: lastDay(6),           label: "2분기" },
    q3:  { start: `${year}-07-01`, end: lastDay(9),           label: "3분기" },
    q4:  { start: `${year}-10-01`, end: `${year}-12-31`,      label: "4분기" },
    h1:  { start: `${year}-01-01`, end: lastDay(6),           label: "상반기" },
    h2:  { start: `${year}-07-01`, end: `${year}-12-31`,      label: "하반기" },
  }
  if (fixed[period]) return fixed[period]

  const m = Number(period)
  if (m >= 1 && m <= 12) {
    const mm = String(m).padStart(2, "0")
    return { start: `${year}-${mm}-01`, end: lastDay(m), label: `${m}월` }
  }
  return fixed.all
}

// ─── 반환 타입 ────────────────────────────────────────────────────────────────
export interface PdfMeta {
  buffer: Buffer
  filename: string
  periodLabel: string
  totalAmount: number
  deductibleAmount: number
}

// ─── PDF 생성 메인 함수 ───────────────────────────────────────────────────────
export async function generateExpensePdf(
  userId: string,
  year: string,
  period: string
): Promise<PdfMeta> {
  const { start, end, label } = getRange(year, period)

  // 지출 데이터 조회
  const { data: rows, error } = await supabaseAdmin
    .from("expenses")
    .select("receipt_date, amount, vendor_name, category, is_deductible, is_expense")
    .eq("user_id", userId)
    .gte("receipt_date", start)
    .lte("receipt_date", end)
    .order("receipt_date", { ascending: true })

  if (error) throw error
  if (!rows || rows.length === 0) throw new Error("데이터 없음")

  // 사업자 정보 조회 (없어도 PDF 생성 계속)
  const { data: biz } = await supabaseAdmin
    .from("business_info")
    .select("business_name, business_number, tax_type")
    .eq("user_id", userId)
    .maybeSingle()

  const totalAmount      = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
  const deductibleAmount = rows
    .filter((r) => r.is_deductible)
    .reduce((s, r) => s + (r.amount ?? 0), 0)

  // ─── jsPDF 초기화 ────────────────────────────────────────────────────────
  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const L     = 15 // 좌측 여백 (mm)

  // 한국어 폰트 적용 (실패 시 helvetica 폴백)
  const fontB64 = await loadKoreanFont()
  let font = "helvetica"
  if (fontB64) {
    try {
      doc.addFileToVFS("NanumGothic.ttf", fontB64)
      doc.addFont("NanumGothic.ttf", "NanumGothic", "normal")
      font = "NanumGothic"
    } catch { /* 폰트 추가 실패 시 기본 폰트 사용 */ }
  }
  doc.setFont(font)

  // ─── 제목 ────────────────────────────────────────────────────────────────
  doc.setFontSize(22)
  doc.setTextColor(20, 20, 20)
  doc.text("지출내역서", pageW / 2, 22, { align: "center" })

  // ─── 부제 (기간 + 날짜 범위) ─────────────────────────────────────────────
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`${year}년 ${label}  (${start} ~ ${end})`, pageW / 2, 30, { align: "center" })

  // ─── 사업자 정보 ──────────────────────────────────────────────────────────
  let y = 40
  if (biz?.business_name) {
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    const infoLines: string[] = []
    if (biz.business_name)   infoLines.push(`상호: ${biz.business_name}`)
    if (biz.business_number) infoLines.push(`사업자번호: ${biz.business_number}`)
    if (biz.tax_type)        infoLines.push(`과세유형: ${biz.tax_type}`)
    infoLines.forEach((line, i) => doc.text(line, L, y + i * 5))
    y += infoLines.length * 5 + 5
  }

  // ─── 구분선 ──────────────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200)
  doc.line(L, y, pageW - L, y)
  y += 4

  // ─── 지출 표 (autoTable) ──────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: L, right: L },
    head: [["번호", "날짜", "업체명", "금액(원)", "카테고리", "부가세공제", "경비처리"]],
    body: rows.map((r, i) => [
      i + 1,
      r.receipt_date,
      r.vendor_name ?? "",
      (r.amount ?? 0).toLocaleString("ko-KR"),
      r.category,
      r.is_deductible        ? "가능" : "불가",
      r.is_expense !== false ? "가능" : "불가",
    ]),
    foot: [[
      "합계", "", "",
      totalAmount.toLocaleString("ko-KR"),
      "",
      deductibleAmount.toLocaleString("ko-KR"),
      "",
    ]],
    styles:     { font, fontSize: 8, cellPadding: 2 },
    headStyles: {
      font,
      fillColor:  [41, 65, 148] as [number, number, number],
      textColor:  255,
      halign:     "center",
    },
    footStyles: {
      font,
      fillColor: [235, 235, 235] as [number, number, number],
      textColor: [30, 30, 30]    as [number, number, number],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { cellWidth: 24 },
      3: { halign: "right",  cellWidth: 26 },
      5: { halign: "center", cellWidth: 22 },
      6: { halign: "center", cellWidth: 18 },
    },
  })

  // ─── 하단 요약 ────────────────────────────────────────────────────────────
  const docWithTable = doc as jsPDF & { lastAutoTable: { finalY: number } }
  const finalY = docWithTable.lastAutoTable.finalY + 6

  doc.setFontSize(9)
  doc.setTextColor(30, 30, 30)
  doc.text(
    `총 지출: ${totalAmount.toLocaleString("ko-KR")}원  |  부가세공제 가능: ${deductibleAmount.toLocaleString("ko-KR")}원`,
    L,
    finalY
  )

  // ─── 생성일시 ─────────────────────────────────────────────────────────────
  const nowStr = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
  doc.setFontSize(7)
  doc.setTextColor(160, 160, 160)
  doc.text(`생성일시: ${nowStr}`, L, finalY + 6)

  const buffer   = Buffer.from(doc.output("arraybuffer"))
  const filename = `지출내역서_${year}년_${label}.pdf`

  return { buffer, filename, periodLabel: label, totalAmount, deductibleAmount }
}
