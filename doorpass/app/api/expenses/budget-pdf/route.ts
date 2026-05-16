// 가계부 PDF 다운로드 — 월별 수입/지출/카테고리별 분석
// GET /api/expenses/budget-pdf?user_id=X&year=YYYY&month=M
import fs from "fs"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAuth } from "@/lib/auth"

// ─── 한국어 폰트 로딩 (NanumGothic) ──────────────────────────────────────────
// 인스턴스당 1회 읽어 캐시. _pdf-generator.ts 와 동일 패턴.
let _cachedFontB64: string | null = null
function loadKoreanFont(): string | null {
  if (_cachedFontB64) return _cachedFontB64
  try {
    const fontPath = path.join(process.cwd(), "public", "fonts", "NanumGothic.ttf")
    _cachedFontB64 = fs.readFileSync(fontPath).toString("base64")
    return _cachedFontB64
  } catch {
    return null
  }
}

// ─── 카테고리 한글 매핑 (PDF 표시용) ─────────────────────────────────────────
const CATEGORY_LABEL: Record<string, string> = {
  유류비: "차량유지비(연료비)",
  수리비: "차량유지비(수리비)",
  식비:   "식비",
  통신비: "통신비",
  기타:   "소모품비/기타",
}

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("user_id")
    const year   = Number(searchParams.get("year")  ?? new Date().getFullYear())
    const month  = Number(searchParams.get("month") ?? new Date().getMonth() + 1)

    if (!userId)               return NextResponse.json({ error: "user_id 필수" }, { status: 400 })
    if (month < 1 || month > 12) return NextResponse.json({ error: "month 1~12" }, { status: 400 })

    // ── 해당 월의 시작/끝 날짜 (YYYY-MM-DD) ─────────────────────────────────
    const mm        = String(month).padStart(2, "0")
    const startDate = `${year}-${mm}-01`
    const lastDay   = new Date(year, month, 0).getDate()
    const endDate   = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`

    // ── 지출: 해당 월 expenses ────────────────────────────────────────────
    const { data: expRows, error: expErr } = await supabaseAdmin
      .from("expenses")
      .select("amount, category")
      .eq("user_id", userId)
      .gte("receipt_date", startDate)
      .lte("receipt_date", endDate)
    if (expErr) throw expErr

    // ── 수입: 해당 월 income (income_date 가 YYYY-MM-01 형식) ─────────────
    const { data: incRows, error: incErr } = await supabaseAdmin
      .from("income")
      .select("total_amount")
      .eq("user_id", userId)
      .gte("income_date", startDate)
      .lte("income_date", endDate)
    if (incErr) throw incErr

    const totalIncome  = (incRows ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0)
    const totalExpense = (expRows ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
    const balance      = totalIncome - totalExpense

    // ── 카테고리별 SUM (GROUP BY) ─────────────────────────────────────────
    const categoryMap = new Map<string, number>()
    for (const r of expRows ?? []) {
      const key = r.category ?? "기타"
      categoryMap.set(key, (categoryMap.get(key) ?? 0) + (r.amount ?? 0))
    }
    // 금액 큰 순으로 정렬
    const categoryRows = Array.from(categoryMap.entries())
      .map(([cat, amount]) => ({
        label: CATEGORY_LABEL[cat] ?? cat,
        amount,
        ratio: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    // ── jsPDF 초기화 ──────────────────────────────────────────────────────
    const doc   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const pageW = doc.internal.pageSize.getWidth()
    const L     = 15

    const fontB64 = loadKoreanFont()
    let font = "helvetica"
    if (fontB64) {
      try {
        doc.addFileToVFS("NanumGothic.ttf", fontB64)
        doc.addFont("NanumGothic.ttf", "NanumGothic", "normal")
        font = "NanumGothic"
      } catch { /* helvetica 폴백 */ }
    }
    doc.setFont(font)

    // ── 제목 ──────────────────────────────────────────────────────────────
    doc.setFontSize(22)
    doc.setTextColor(20, 20, 20)
    doc.text(`${year}년 ${month}월 가계부`, pageW / 2, 22, { align: "center" })

    // ── 부제 (기간) ───────────────────────────────────────────────────────
    doc.setFontSize(10)
    doc.setTextColor(120, 120, 120)
    doc.text(`(${startDate} ~ ${endDate})`, pageW / 2, 30, { align: "center" })

    // ── 요약 박스 3개 (수입 / 지출 / 잔액) ────────────────────────────────
    const boxY   = 38
    const boxH   = 22
    const boxW   = (pageW - L * 2 - 4) / 3  // 좌우 여백 + 박스 간격 2mm * 2
    const boxes  = [
      { label: "수입", value: totalIncome,  color: [219, 234, 254] as [number, number, number], textColor: [30, 64, 175] as [number, number, number] },
      { label: "지출", value: totalExpense, color: [254, 226, 226] as [number, number, number], textColor: [153, 27, 27] as [number, number, number] },
      { label: "잔액", value: balance,      color: balance >= 0 ? [219, 234, 254] as [number, number, number] : [254, 226, 226] as [number, number, number], textColor: balance >= 0 ? [30, 64, 175] as [number, number, number] : [153, 27, 27] as [number, number, number] },
    ]
    boxes.forEach((b, i) => {
      const x = L + (boxW + 2) * i
      doc.setFillColor(b.color[0], b.color[1], b.color[2])
      doc.roundedRect(x, boxY, boxW, boxH, 3, 3, "F")
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text(b.label, x + 4, boxY + 7)
      doc.setFontSize(13)
      doc.setTextColor(b.textColor[0], b.textColor[1], b.textColor[2])
      doc.text(`${b.value.toLocaleString("ko-KR")}원`, x + boxW - 4, boxY + 16, { align: "right" })
    })

    // ── 카테고리별 지출 표 ───────────────────────────────────────────────
    const tableY = boxY + boxH + 8

    if (categoryRows.length === 0) {
      doc.setFontSize(11)
      doc.setTextColor(120, 120, 120)
      doc.text("이번달 지출 내역이 없습니다.", pageW / 2, tableY + 10, { align: "center" })
    } else {
      autoTable(doc, {
        startY: tableY,
        margin: { left: L, right: L },
        head: [["카테고리", "금액(원)", "비율"]],
        body: categoryRows.map((r) => [
          r.label,
          r.amount.toLocaleString("ko-KR"),
          `${r.ratio.toFixed(1)}%`,
        ]),
        foot: [["합계", totalExpense.toLocaleString("ko-KR"), "100%"]],
        styles:     { font, fontSize: 10, cellPadding: 3 },
        headStyles: {
          font,
          fillColor: [41, 65, 148] as [number, number, number],
          textColor: 255,
          halign:    "center",
        },
        footStyles: {
          font,
          fontSize:  11,
          fillColor: [235, 235, 235] as [number, number, number],
          textColor: [30, 30, 30] as [number, number, number],
        },
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
        },
      })
    }

    // ── 하단 푸터 ─────────────────────────────────────────────────────────
    const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } }
    const finalY = (docWithTable.lastAutoTable?.finalY ?? tableY) + 12

    doc.setFontSize(8)
    doc.setTextColor(160, 160, 160)
    doc.text("TaxPass로 자동 생성된 가계부", pageW / 2, finalY, { align: "center" })

    const nowStr = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    doc.text(`생성일시: ${nowStr}`, pageW / 2, finalY + 5, { align: "center" })

    // ── 응답 ──────────────────────────────────────────────────────────────
    const buffer   = Buffer.from(doc.output("arraybuffer"))
    const filename = `가계부_${year}년_${month}월.pdf`
    const encodedFilename = encodeURIComponent(filename)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF 생성 오류"
    console.error("가계부 PDF 생성 오류:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
