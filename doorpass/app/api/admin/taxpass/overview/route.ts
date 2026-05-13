// 관리자 TaxPass 대시보드 통계 API
// GET /api/admin/taxpass/overview
import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

// 가격: Claude API 1건당 약 4원 (사용자 정의)
const CLAUDE_API_COST_PER_RECEIPT = 4

export async function GET() {
  try {
    const { unauthorized } = await requireAdminApi()
    if (unauthorized) return unauthorized

    // ── 이번달 시작/끝 날짜 ───────────────────────────────────────────────
    const now      = new Date()
    const year     = now.getFullYear()
    const month    = now.getMonth() + 1
    const mm       = String(month).padStart(2, "0")
    const lastDay  = new Date(year, month, 0).getDate()
    const monStart = `${year}-${mm}-01`
    const monEnd   = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`

    // 6개월 시계열 시작
    const sixStart = new Date(year, month - 6, 1)
    const sixStartStr = `${sixStart.getFullYear()}-${String(sixStart.getMonth() + 1).padStart(2, "0")}-01`

    // ── 병렬 조회 ───────────────────────────────────────────────────────
    const [
      taxpassUserCntRes,
      monthlyReceiptsRes,
      ocrAllRes,
      historyExpRes,
      recentExpRes,
    ] = await Promise.all([
      // TaxPass 회원수: expenses 또는 income 테이블에 1건이라도 있는 user_id 의 distinct count
      // 간단화: approved_users 중 role 무관 전체 활성 회원수
      supabaseAdmin
        .from("approved_users")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      // 이번달 영수증 업로드 건수
      supabaseAdmin
        .from("expenses")
        .select("id", { count: "exact", head: true })
        .gte("receipt_date", monStart)
        .lte("receipt_date", monEnd),
      // OCR 성공률: receipt_image_url 이 있으면 OCR 시도된 것으로 간주
      //  - 분모: 영수증 이미지 첨부된 건수 (이번달)
      //  - 분자: 그 중 vendor_name 또는 amount 가 채워진 건수
      supabaseAdmin
        .from("expenses")
        .select("id, vendor_name, amount, receipt_image_url")
        .gte("receipt_date", monStart)
        .lte("receipt_date", monEnd)
        .not("receipt_image_url", "is", null),
      // 최근 6개월 expenses (월별 집계용)
      supabaseAdmin
        .from("expenses")
        .select("receipt_date")
        .gte("receipt_date", sixStartStr)
        .lte("receipt_date", monEnd),
      // 최근 업로드 20건 (관계 select)
      supabaseAdmin
        .from("expenses")
        .select(`
          id, receipt_date, amount, vendor_name, category, receipt_image_url, user_id,
          approved_users:user_id ( name )
        `)
        .order("created_at", { ascending: false })
        .limit(20),
    ])

    // ── OCR 성공률 계산 ─────────────────────────────────────────────────
    const ocrRows = ocrAllRes.data ?? []
    const ocrTotal   = ocrRows.length
    const ocrSuccess = ocrRows.filter((r) => r.vendor_name && (r.amount ?? 0) > 0).length
    const ocrRate    = ocrTotal > 0 ? (ocrSuccess / ocrTotal) * 100 : 0

    // ── 6개월 월별 영수증 건수 ───────────────────────────────────────────
    const historyRows = historyExpRes.data ?? []
    const monthCount: Record<string, number> = {}
    for (const r of historyRows) {
      const key = (r.receipt_date as string).slice(0, 7) // YYYY-MM
      monthCount[key] = (monthCount[key] ?? 0) + 1
    }
    const history: { label: string; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const key = `${y}-${String(m).padStart(2, "0")}`
      history.push({ label: `${m}월`, count: monthCount[key] ?? 0 })
    }

    // ── 최근 업로드 20건 (회원명 join) ───────────────────────────────────
    type RecentRow = {
      id: string
      receipt_date: string
      amount: number | null
      vendor_name: string | null
      category: string | null
      receipt_image_url: string | null
      user_id: number | null
      approved_users: { name: string | null } | { name: string | null }[] | null
    }
    const recent = (recentExpRes.data ?? []).map((r: RecentRow) => {
      const userObj = Array.isArray(r.approved_users) ? r.approved_users[0] : r.approved_users
      return {
        id: r.id,
        receipt_date: r.receipt_date,
        amount: r.amount ?? 0,
        vendor_name: r.vendor_name ?? "(미입력)",
        category: r.category ?? "기타",
        user_name: userObj?.name ?? "(이름 없음)",
        ocr_used: Boolean(r.receipt_image_url),
      }
    })

    const monthlyReceipts = monthlyReceiptsRes.count ?? 0

    return NextResponse.json({
      taxpassUsers:     taxpassUserCntRes.count ?? 0,
      monthlyReceipts,
      estimatedCost:    monthlyReceipts * CLAUDE_API_COST_PER_RECEIPT, // 원
      ocrRate:          Number(ocrRate.toFixed(1)),
      history,
      recent,
    })
  } catch (err) {
    console.error("[taxpass/overview] 오류:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
