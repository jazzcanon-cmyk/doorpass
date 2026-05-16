// 관리자 TaxPass 알림톡 발송 API
// POST /api/admin/tax-notification
//   body: { type: "vat_d30" | "vat_d7" | "monthly_remind" | "tax_estimate",
//           targetUserIds?: number[] }
//
// 기본 카카오 알림톡 템플릿이 아직 등록되지 않은 단계이므로,
// 일단 Solapi의 일반 SMS(메시지) 발송으로 폴백한다. 추후 templateId를 환경변수로 받으면
// kakaoOptions를 추가해 알림톡으로 자동 승격할 수 있다.
import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

export type NotifyType = "vat_d30" | "vat_d7" | "monthly_remind" | "tax_estimate"

// ─── Solapi HMAC 인증 헤더 ───────────────────────────────────────────────────
function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString("hex")
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex")
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

// ─── 메시지 빌더 ─────────────────────────────────────────────────────────────
// 사용자별 변수(이름, 이번달 지출/공제/세금 등)는 호출자가 미리 계산해 전달한다.
export interface UserNotifyContext {
  name: string
  monthExpense: number       // 이번달 지출
  deductible: number         // 공제 가능 금액 (부가세공제 true 합계)
  receiptCount: number       // 이번달 영수증 건수
  estimatedVat: number       // 예상 부가세 (단순 추정)
  estimatedIncomeTax: number // 예상 종소세 (단순 추정)
  reserveMonthly: number     // 월 적립 권장액
}

function buildMessage(type: NotifyType, ctx: UserNotifyContext): string {
  const krw = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`
  switch (type) {
    case "vat_d30":
      return [
        "[TaxPass] 부가세 신고 안내",
        `안녕하세요 ${ctx.name}님!`,
        "부가세 신고 마감이 30일 남았습니다.",
        "",
        "영수증을 미리 정리해두면",
        "신고가 훨씬 편해집니다.",
        "",
        "📊 현재 등록 현황:",
        `이번달 지출: ${krw(ctx.monthExpense)}`,
        `공제 가능 금액: ${krw(ctx.deductible)}`,
        "",
        "TaxPass에서 확인하기 →",
      ].join("\n")
    case "vat_d7":
      return [
        "[TaxPass] ⚠️ 부가세 신고 7일 전!",
        `${ctx.name}님, 서두르세요!`,
        "",
        `예상 납부 세액: ${krw(ctx.estimatedVat)}`,
        "신고 마감: 7월 25일",
        "",
        "지금 바로 세무사에게 자료 전달하기 →",
      ].join("\n")
    case "monthly_remind": {
      const m = new Date().getMonth() + 1
      return [
        "[TaxPass] 이번달 영수증 정리하셨나요?",
        `${ctx.name}님의 ${m}월 현황:`,
        `✅ 등록된 영수증: ${ctx.receiptCount}건`,
        `💰 총 지출: ${krw(ctx.monthExpense)}`,
        "",
        "월말 전에 빠진 영수증 없는지",
        "확인해보세요! →",
      ].join("\n")
    }
    case "tax_estimate": {
      const m = new Date().getMonth() + 1
      const quarter = Math.ceil(m / 3)
      return [
        `[TaxPass] 📊 ${quarter}분기 세금 예측`,
        `${ctx.name}님의 예상 납부액:`,
        `부가세: ${krw(ctx.estimatedVat)} (7월 25일)`,
        `종소세: ${krw(ctx.estimatedIncomeTax)} (내년 5월)`,
        "",
        `지금부터 월 ${krw(ctx.reserveMonthly)}씩 준비하면`,
        "세금 폭탄 없이 대비 가능합니다! →",
      ].join("\n")
    }
  }
}

// ─── 사용자별 변수 계산 (지난 30일 expenses + 이번달 income) ─────────────────
async function buildContextForUser(userId: number, name: string | null): Promise<UserNotifyContext> {
  const now      = new Date()
  const year     = now.getFullYear()
  const month    = now.getMonth() + 1
  const mm       = String(month).padStart(2, "0")
  const lastDay  = new Date(year, month, 0).getDate()
  const monStart = `${year}-${mm}-01`
  const monEnd   = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`

  // 분기 시작 (예상 부가세 계산용)
  const qStartMonth = (Math.ceil(month / 3) - 1) * 3 + 1
  const qStart      = `${year}-${String(qStartMonth).padStart(2, "0")}-01`

  const [expMonthRes, expQuarterRes, incMonthRes, incQuarterRes, incYearRes] = await Promise.all([
    supabaseAdmin
      .from("expenses")
      .select("amount, is_deductible")
      .eq("user_id", userId)
      .gte("receipt_date", monStart)
      .lte("receipt_date", monEnd),
    supabaseAdmin
      .from("expenses")
      .select("amount, is_deductible")
      .eq("user_id", userId)
      .gte("receipt_date", qStart)
      .lte("receipt_date", monEnd),
    supabaseAdmin
      .from("income")
      .select("total_amount, vat_amount")
      .eq("user_id", userId)
      .gte("income_date", monStart)
      .lte("income_date", monEnd),
    supabaseAdmin
      .from("income")
      .select("total_amount, vat_amount")
      .eq("user_id", userId)
      .gte("income_date", qStart)
      .lte("income_date", monEnd),
    supabaseAdmin
      .from("income")
      .select("total_amount")
      .eq("user_id", userId)
      .gte("income_date", `${year}-01-01`)
      .lte("income_date", monEnd),
  ])

  const monExp     = expMonthRes.data ?? []
  const quarterExp = expQuarterRes.data ?? []
  const incYear    = incYearRes.data ?? []

  const monthExpense = monExp.reduce((s, r) => s + (r.amount ?? 0), 0)
  const deductible   = monExp.filter((r) => r.is_deductible).reduce((s, r) => s + (r.amount ?? 0), 0)
  const receiptCount = monExp.length

  // 예상 부가세 = 분기 매출VAT - 분기 공제가능 매입VAT(추정: 공제대상 금액의 1/11)
  const incQuarter = incQuarterRes.data ?? []
  const quarterIncomeVat = incQuarter.reduce((s, r) => s + (r.vat_amount ?? 0), 0)
  const quarterDeductible = quarterExp.filter((r) => r.is_deductible).reduce((s, r) => s + (r.amount ?? 0), 0)
  const estimatedVat = Math.max(0, quarterIncomeVat - Math.round(quarterDeductible / 11))

  // 예상 종소세 = 연간 매출 × 6.6% (간단 추정)
  const yearIncome = incYear.reduce((s, r) => s + (r.total_amount ?? 0), 0)
  const estimatedIncomeTax = Math.round(yearIncome * 0.066)

  // 월 적립 권장액 = (부가세 + 종소세) / 12
  const reserveMonthly = Math.round((estimatedVat + estimatedIncomeTax) / 12)

  return {
    name: name ?? "고객",
    monthExpense,
    deductible,
    receiptCount,
    estimatedVat,
    estimatedIncomeTax,
    reserveMonthly,
  }
}

// ─── Solapi 메시지 발송 (알림톡 templateId 있으면 알림톡, 없으면 SMS) ────────
async function sendOne(phone: string, text: string, type: NotifyType): Promise<"sent" | "skipped" | "failed"> {
  const apiKey       = process.env.SOLAPI_API_KEY
  const apiSecret    = process.env.SOLAPI_API_SECRET
  const senderPhone  = process.env.SOLAPI_SENDER_PHONE
  if (!apiKey || !apiSecret || !senderPhone) return "skipped"

  const to   = phone.replace(/\D/g, "")
  const from = senderPhone.replace(/\D/g, "")
  if (to.length < 10) return "skipped"

  // type별 templateId 환경변수 (등록되면 자동 알림톡으로 승격)
  const tplEnvKey = {
    vat_d30:        "SOLAPI_TPL_VAT_D30",
    vat_d7:         "SOLAPI_TPL_VAT_D7",
    monthly_remind: "SOLAPI_TPL_MONTHLY_REMIND",
    tax_estimate:   "SOLAPI_TPL_TAX_ESTIMATE",
  }[type]
  const templateId = process.env[tplEnvKey]
  const pfId       = process.env.SOLAPI_PF_ID

  // 메시지 페이로드: 알림톡 또는 LMS(2000자) — 90자 초과 시 SMS 못 보냄
  const isLongMsg = text.length > 90
  const messagePayload: Record<string, unknown> = {
    to,
    from,
    text,
    type: templateId ? "ATA" : isLongMsg ? "LMS" : "SMS",
    ...(templateId && pfId
      ? { kakaoOptions: { pfId, templateId } }
      : {}),
  }

  try {
    const res = await fetchWithTimeout("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(apiKey, apiSecret),
      },
      body: JSON.stringify({ message: messagePayload }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error("[tax-notification] Solapi 발송 실패:", JSON.stringify(err))
      return "failed"
    }
    return "sent"
  } catch (err) {
    console.error("[tax-notification] Solapi 발송 오류:", (err as Error).message)
    return "failed"
  }
}

// ─── 메인 핸들러 ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // 인증: admin 세션 또는 cron 비밀 헤더 둘 중 하나
    const cronSecret = process.env.CRON_SECRET
    const cronHeader = req.headers.get("x-cron-secret") ?? ""
    const isCron     = Boolean(cronSecret) && cronHeader === cronSecret
    if (!isCron) {
      const { unauthorized } = await requireAdminApi()
      if (unauthorized) return unauthorized
    }

    const body = (await req.json().catch(() => ({}))) as {
      type?: NotifyType
      targetUserIds?: number[]
    }
    const type = body.type
    if (!type || !["vat_d30", "vat_d7", "monthly_remind", "tax_estimate"].includes(type)) {
      return NextResponse.json({ error: "type 필수" }, { status: 400 })
    }

    // 대상자 조회: targetUserIds 가 있으면 그 회원만, 없으면 활성 회원 전체 (phone 있는 사람만)
    let query = supabaseAdmin
      .from("approved_users")
      .select("id, name, phone")
      .eq("is_active", true)
      .not("phone", "is", null)
    if (body.targetUserIds && body.targetUserIds.length > 0) {
      query = query.in("id", body.targetUserIds)
    }
    const { data: users, error } = await query
    if (error) throw error

    // 사용자별 변수 계산 + 발송 (순차 — 동시 부하 회피)
    let sent = 0, failed = 0, skipped = 0
    for (const u of users ?? []) {
      if (!u.phone) { skipped++; continue }
      const ctx  = await buildContextForUser(u.id as number, u.name as string | null)
      const text = buildMessage(type, ctx)
      const out  = await sendOne(u.phone as string, text, type)
      if      (out === "sent")    sent++
      else if (out === "skipped") skipped++
      else                        failed++
    }

    return NextResponse.json({
      type,
      total:  users?.length ?? 0,
      sent,
      failed,
      skipped,
    })
  } catch (err) {
    console.error("[tax-notification] 오류:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
