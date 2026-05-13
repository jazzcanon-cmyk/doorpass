// Vercel Cron — 매일 오전 9시(KST) 자동 발송 트리거
// vercel.json crons: "0 0 * * *" (UTC 00:00 = KST 09:00)
//
// 발송 규칙:
//   - 부가세 신고 마감일(1월 25일, 7월 25일)까지 D-30 인 날 → vat_d30
//   - D-7 인 날 → vat_d7
//   - 매월 25일 → monthly_remind
//
// 인증: Vercel Cron은 Authorization: Bearer ${CRON_SECRET} 헤더로 보호.
//       로컬 테스트 시 CRON_SECRET 미설정이면 누구나 호출 가능 (의도된 dev 동작).
import { NextRequest, NextResponse } from "next/server"
import type { NotifyType } from "../../admin/tax-notification/route"

// ─── 부가세 신고 마감일 계산 (다음 마감일까지의 일수) ────────────────────────
function daysUntil(target: Date, base = new Date()): number {
  // 시간/분/초 무시 — 날짜 단위 차이만
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const b = new Date(base.getFullYear(),   base.getMonth(),   base.getDate()).getTime()
  return Math.round((a - b) / 86400_000)
}

function getNextVatDeadline(base = new Date()): Date {
  // 부가세 신고: 1월 25일, 7월 25일
  const y = base.getFullYear()
  const candidates = [
    new Date(y,     0, 25),
    new Date(y,     6, 25),
    new Date(y + 1, 0, 25),
  ]
  for (const d of candidates) {
    if (d.getTime() >= new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime()) return d
  }
  return candidates[2]
}

// 내부 호출용 fetch — Vercel 환경에서는 절대 URL 필요
function getBaseUrl(req: NextRequest): string {
  const host  = req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") ?? "https"
  return `${proto}://${host}`
}

async function triggerNotification(req: NextRequest, type: NotifyType): Promise<{ type: NotifyType; ok: boolean; status: number; body: unknown }> {
  // Cron은 admin 세션이 없으므로, 같은 서버에서 supabaseAdmin 로직을 재호출하는 방식이 이상적이나
  // 단순화를 위해 tax-notification 라우트를 cron-secret 헤더로 자체 호출한다.
  const url = `${getBaseUrl(req)}/api/admin/tax-notification`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // requireAdminApi 우회 토큰 — tax-notification 라우트에서 검증
      "x-cron-secret": process.env.CRON_SECRET ?? "",
    },
    body: JSON.stringify({ type }),
  })
  const body = await res.json().catch(() => ({}))
  return { type, ok: res.ok, status: res.status, body }
}

export async function GET(req: NextRequest) {
  try {
    // Vercel Cron 인증: Authorization: Bearer <CRON_SECRET>
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const auth = req.headers.get("authorization") ?? ""
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 })
      }
    }

    const now      = new Date()
    const deadline = getNextVatDeadline(now)
    const dDay     = daysUntil(deadline, now)
    const today    = now.getDate()

    // 발송 트리거 결정
    const triggered: NotifyType[] = []
    if (dDay === 30) triggered.push("vat_d30")
    if (dDay === 7)  triggered.push("vat_d7")
    if (today === 25) triggered.push("monthly_remind")

    const results: { type: NotifyType; ok: boolean; status: number; body: unknown }[] = []
    for (const t of triggered) {
      results.push(await triggerNotification(req, t))
    }

    return NextResponse.json({
      checkedAt: now.toISOString(),
      vatDeadline: deadline.toISOString().split("T")[0],
      dDay,
      today,
      triggered,
      results,
    })
  } catch (err) {
    console.error("[cron/tax-notification] 오류:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
