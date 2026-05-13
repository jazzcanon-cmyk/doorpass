"use client"
// 관리자 TaxPass 대시보드 — 회원/영수증/세금/알림톡 발송
import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts"

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface OverviewData {
  taxpassUsers:    number
  monthlyReceipts: number
  estimatedCost:   number               // 원
  ocrRate:         number               // %
  history:         { label: string; count: number }[]
  recent:          {
    id: string
    receipt_date: string
    amount: number
    vendor_name: string
    category: string
    user_name: string
    ocr_used: boolean
  }[]
}

type NotifyType = "vat_d30" | "vat_d7" | "monthly_remind" | "tax_estimate"

const NOTIFY_LABELS: Record<NotifyType, string> = {
  vat_d30:        "부가세 D-30 알림 발송",
  vat_d7:         "부가세 D-7 알림 발송",
  monthly_remind: "월말 독려 알림 발송",
  tax_estimate:   "예상 세금 알림 발송",
}

// ─── 세금 신고 마감일 (다음 도래일까지 D-day) ────────────────────────────────
function daysUntil(target: Date, base = new Date()): number {
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const b = new Date(base.getFullYear(),   base.getMonth(),   base.getDate()).getTime()
  return Math.round((a - b) / 86400_000)
}
function getNextVatDeadline(base = new Date()): Date {
  // 부가세 신고: 1월 25일, 7월 25일
  const y = base.getFullYear()
  const cands = [new Date(y, 0, 25), new Date(y, 6, 25), new Date(y + 1, 0, 25)]
  for (const d of cands) {
    if (d.getTime() >= new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime()) return d
  }
  return cands[2]
}
function getNextIncomeTaxDeadline(base = new Date()): Date {
  // 종합소득세: 매년 5월 31일
  const y = base.getFullYear()
  const this0531 = new Date(y, 4, 31)
  return this0531.getTime() >= new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime()
    ? this0531
    : new Date(y + 1, 4, 31)
}
function ddayColor(d: number): string {
  if (d <= 7)  return "text-red-400"
  if (d >= 30) return "text-emerald-400"
  return "text-amber-400"
}

export function TaxpassDashboard() {
  const [data, setData]     = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  // 발송 중 상태 — type별 개별 disable
  const [sendingType, setSendingType] = useState<NotifyType | null>(null)

  // ── overview 조회 ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/admin/taxpass/overview")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as OverviewData
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── 알림톡 발송 ──────────────────────────────────────────────────────────
  const handleSend = async (type: NotifyType) => {
    const label = NOTIFY_LABELS[type]
    if (!confirm(`전체 TaxPass 회원에게 "${label}"을(를) 발송합니다.\n계속하시겠습니까?`)) return
    setSendingType(type)
    try {
      const res = await fetch("/api/admin/tax-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      toast.success(
        `발송 완료: 전송 ${json.sent ?? 0} / 실패 ${json.failed ?? 0} / 스킵 ${json.skipped ?? 0}`
      )
    } catch (e) {
      toast.error(`발송 오류: ${(e as Error).message}`)
    } finally {
      setSendingType(null)
    }
  }

  // ── D-day 계산 (클라이언트 렌더) ─────────────────────────────────────────
  const now             = new Date()
  const vatDeadline     = getNextVatDeadline(now)
  const incomeDeadline  = getNextIncomeTaxDeadline(now)
  const vatDDay         = daysUntil(vatDeadline, now)
  const incomeDDay      = daysUntil(incomeDeadline, now)
  const fmtDate = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`

  // ─── 렌더 ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="h-8 w-48 rounded bg-white/10 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0,1,2,3].map((i) => <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
        <div className="h-48 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-red-400 text-sm">
        오류: {error ?? "데이터 없음"}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">📒 TaxPass 관리</h1>
        <span className="text-xs text-white/40">
          {now.getFullYear()}년 {now.getMonth() + 1}월 기준
        </span>
      </div>

      {/* ── 요약 카드 4개 ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
          <p className="text-[11px] text-white/40">👥 TaxPass 회원수</p>
          <p className="text-xl font-bold text-white">{data.taxpassUsers.toLocaleString()}명</p>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
          <p className="text-[11px] text-white/40">📸 이번달 영수증</p>
          <p className="text-xl font-bold text-emerald-400">{data.monthlyReceipts.toLocaleString()}건</p>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
          <p className="text-[11px] text-white/40">💸 Claude API 예상 비용</p>
          <p className="text-xl font-bold text-blue-400">{data.estimatedCost.toLocaleString()}원</p>
          <p className="text-[10px] text-white/30">건당 4원 × {data.monthlyReceipts}건</p>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
          <p className="text-[11px] text-white/40">✅ OCR 성공률</p>
          <p className="text-xl font-bold text-amber-400">{data.ocrRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* ── 세금 신고 D-day ─────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
        <p className="text-sm font-semibold text-white/70">📅 세금 신고 D-day</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-[11px] text-white/40">부가세 신고 ({fmtDate(vatDeadline)})</p>
            <p className={`text-2xl font-bold ${ddayColor(vatDDay)}`}>D-{vatDDay}일</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-[11px] text-white/40">종합소득세 ({fmtDate(incomeDeadline)})</p>
            <p className={`text-2xl font-bold ${ddayColor(incomeDDay)}`}>D-{incomeDDay}일</p>
          </div>
        </div>
      </div>

      {/* ── 월별 영수증 업로드 바 차트 ─────────────────────────────────────── */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
        <p className="text-sm font-semibold text-white/70">📊 월별 사용 통계 (영수증 업로드)</p>
        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.history} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <RechartsTooltip
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => `${v.toLocaleString()}건`}
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
              />
              <Bar dataKey="count" name="영수증 건수" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 카카오 알림 발송 ────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
        <p className="text-sm font-semibold text-white/70">💬 카카오 알림 발송 (Solapi 알림톡 / SMS 폴백)</p>
        <p className="text-[11px] text-white/40">
          전체 활성 회원에게 발송합니다. 알림톡 템플릿(SOLAPI_TPL_*)이 설정되어 있으면 알림톡, 아니면 SMS/LMS로 자동 폴백됩니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(Object.keys(NOTIFY_LABELS) as NotifyType[]).map((t) => (
            <button
              key={t}
              onClick={() => void handleSend(t)}
              disabled={sendingType !== null}
              className="h-11 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-indigo-300 transition-all"
            >
              {sendingType === t ? <>⏳ 발송 중...</> : NOTIFY_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── 최근 업로드 20건 ───────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
        <p className="text-sm font-semibold text-white/70">📥 최근 업로드 현황 (최근 20건)</p>
        {data.recent.length === 0 ? (
          <p className="text-center text-sm text-white/40 py-6">최근 업로드 내역이 없습니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-white/10 text-white/50">
                <tr>
                  <th className="text-left py-2 pr-2">날짜</th>
                  <th className="text-left py-2 pr-2">회원명</th>
                  <th className="text-right py-2 pr-2">금액</th>
                  <th className="text-left py-2 pr-2">카테고리</th>
                  <th className="text-center py-2">OCR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.recent.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 pr-2 text-white/60 whitespace-nowrap">{r.receipt_date}</td>
                    <td className="py-2 pr-2 text-white/80 truncate max-w-[140px]">{r.user_name}</td>
                    <td className="py-2 pr-2 text-right text-white tabular-nums whitespace-nowrap">{r.amount.toLocaleString()}원</td>
                    <td className="py-2 pr-2 text-white/60">{r.category}</td>
                    <td className="py-2 text-center">{r.ocr_used ? "✅" : "✏️"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
