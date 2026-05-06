"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, ShieldCheck, Clock, ShieldAlert, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface RoleRequest {
  id: string
  status: "pending" | "approved" | "rejected"
  reason: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

interface FeedbackRow {
  id: number
  category: "bug" | "feature" | "complaint" | "password_error" | "general"
  building_name: string | null
  content: string
  status: "new" | "reading" | "resolved" | "rejected"
  admin_reply: string | null
  replied_at: string | null
  created_at: string
}

const CATEGORY_LABEL: Record<FeedbackRow["category"], string> = {
  bug: "🐛 버그",
  feature: "💡 기능요청",
  complaint: "😤 불편사항",
  password_error: "⚠️ 비밀번호 오류",
  general: "💬 기타",
}

const STATUS_LABEL: Record<FeedbackRow["status"], string> = {
  new: "🆕 신규",
  reading: "📖 확인중",
  resolved: "✅ 해결",
  rejected: "❌ 반려",
}

export default function SettingsPage() {
  const [role, setRole] = useState<string>("driver")
  const [pending, setPending] = useState<RoleRequest | null>(null)
  const [rejected, setRejected] = useState<RoleRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // 피드백 상태
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackCategory, setFeedbackCategory] =
    useState<"bug" | "feature" | "complaint">("bug")
  const [feedbackContent, setFeedbackContent] = useState("")
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const [meRes, reqRes] = await Promise.all([
        fetch("/api/users/me"),
        fetch("/api/role-requests"),
      ])
      if (meRes.ok) {
        const me = await meRes.json()
        setRole(me.role ?? "driver")
      }
      if (reqRes.ok) {
        const { requests } = await reqRes.json()
        const all = requests as RoleRequest[]
        setPending(all.find((r) => r.status === "pending") ?? null)
        const latestRejected = all
          .filter((r) => r.status === "rejected")
          .sort((a, b) => new Date(b.reviewed_at ?? b.created_at).getTime() - new Date(a.reviewed_at ?? a.created_at).getTime())[0] ?? null
        setRejected(latestRejected)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadFeedbacks = async () => {
    try {
      const res = await fetch("/api/feedbacks", { cache: "no-store" })
      if (!res.ok) return
      const d = (await res.json()) as { feedbacks?: FeedbackRow[] }
      setFeedbacks(d.feedbacks ?? [])
    } catch {}
  }

  useEffect(() => {
    void load()
    void loadFeedbacks()
  }, [])

  const submit = async () => {
    if (reason.trim().length < 10) {
      toast.error("요청 사유를 10자 이상 입력해주세요.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/role-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error("요청 실패")
        return
      }
      toast.success("권한 요청이 전송되었습니다. 관리자 승인 후 알려드립니다.")
      setReason("")
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const submitFeedback = async () => {
    if (feedbackContent.trim().length < 5) {
      toast.error("내용을 5자 이상 입력해주세요.")
      return
    }
    setFeedbackSubmitting(true)
    try {
      const res = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: feedbackCategory,
          content: feedbackContent.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error || "전송에 실패했습니다.")
        return
      }
      toast.success("의견이 전달되었습니다. 감사합니다!")
      setFeedbackOpen(false)
      setFeedbackContent("")
      void loadFeedbacks()
    } catch {
      toast.error("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  const roleLabel =
    role === "admin"
      ? "관리자"
      : role === "sub_admin"
        ? "부관리자"
        : role === "editor"
          ? "편집자"
          : "일반 사용자"

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white/40 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-bold">설정</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-xl space-y-6">
        {(role === "admin" || role === "sub_admin") && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-2">
            <h2 className="text-sm font-semibold mb-2">관리 화면 바로가기</h2>
            {role === "admin" && (
              <Link href="/admin" className="block">
                <Button className="w-full justify-center">🛡️ 관리자 화면으로 이동</Button>
              </Link>
            )}
            {(role === "admin" || role === "sub_admin") && (
              <Link href="/sub-admin" className="block">
                <Button variant="outline" className="w-full justify-center">
                  🏢 부관리자 화면 (Excel 업로드)
                </Button>
              </Link>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-400" /> 내 권한
          </h2>
          <p className="text-xs text-white/50 mb-4">
            현재 역할: <span className="font-semibold text-white">{roleLabel}</span>
          </p>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            </div>
          ) : role !== "driver" ? (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              건물 정보를 수정할 수 있는 권한이 있습니다.
            </div>
          ) : pending ? (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              편집자 권한 요청이 대기 중입니다. 관리자 승인을 기다려주세요.
            </div>
          ) : rejected ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-0.5">이전 권한 요청이 거절됐어요</p>
                  <p className="text-xs text-red-300/70">사유를 추가해 다시 요청할 수 있어요.</p>
                </div>
              </div>
              <div className="border-t border-white/10 pt-4">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-blue-400" /> 편집자 권한 다시 요청
                </h3>
                <textarea
                  placeholder="권한이 필요한 사유를 입력해주세요 (10자 이상)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl bg-white/[0.05] border border-white/10 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 mb-3"
                />
                <Button onClick={submit} disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "다시 요청하기"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-t border-white/10 pt-4">
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-blue-400" /> 편집자 권한 요청
              </h3>
              <p className="text-xs text-white/50 mb-3">
                건물 정보(비밀번호·이름·메모)를 수정하려면 편집자 권한이 필요합니다.
              </p>
              <textarea
                placeholder="권한이 필요한 사유를 입력해주세요 (10자 이상)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="w-full rounded-xl bg-white/[0.05] border border-white/10 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 mb-3"
              />
              <Button onClick={submit} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "권한 요청"}
              </Button>
            </div>
          )}
        </section>

        {/* 의견 보내기 */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-400" /> 의견 보내기
          </h2>
          <p className="text-xs text-white/50 mb-4">
            버그·불편·기능요청 등 자유롭게 알려주세요. 관리자가 직접 확인하고 답변드려요.
          </p>
          <Button
            onClick={() => { setFeedbackOpen(true); setFeedbackContent("") }}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            📝 의견 보내기
          </Button>

          {feedbacks.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4 space-y-2">
              <p className="text-xs text-white/40 mb-1">내 의견 이력 ({feedbacks.length}건)</p>
              {feedbacks.slice(0, 8).map((fb) => {
                const date = new Date(fb.created_at).toLocaleDateString("ko-KR", {
                  year: "2-digit", month: "2-digit", day: "2-digit",
                })
                return (
                  <div key={fb.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-white/80 font-medium truncate">{CATEGORY_LABEL[fb.category]}</span>
                      <span className="text-white/50 shrink-0">{STATUS_LABEL[fb.status]}</span>
                    </div>
                    <p className="text-white/60 line-clamp-2 mb-1">{fb.content}</p>
                    <p className="text-[10px] text-white/30">{date}{fb.building_name ? ` · ${fb.building_name}` : ""}</p>
                    {fb.admin_reply && (
                      <div className="mt-2 rounded-md bg-blue-500/10 border border-blue-500/20 p-2 text-blue-200">
                        <p className="text-[10px] font-semibold mb-0.5">관리자 답변</p>
                        <p className="text-xs">{fb.admin_reply}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 사업자 정보 */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-sm font-semibold mb-3 text-white/80">사업자 정보</h2>
          <dl className="text-xs text-white/60 space-y-1.5 leading-relaxed">
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-white/40">서비스명</dt>
              <dd className="text-white/80">DoorPass (도어패스)</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-white/40">상호</dt>
              <dd>(주)상상커머스 (CJ대한통운택배 신정대리점)</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-white/40">대표</dt>
              <dd>박진성</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-white/40">사업자번호</dt>
              <dd className="font-mono">341-88-00423</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-white/40">주소</dt>
              <dd>울산 남구 산업로625번길 9</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-white/40">연락처</dt>
              <dd>
                <a href="tel:010-5008-0008" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                  010-5008-0008
                </a>
              </dd>
            </div>
          </dl>
          <div className="mt-4 pt-3 border-t border-white/[0.06]">
            <Link href="/terms" className="text-[11px] text-white/40 hover:text-white/70 underline underline-offset-2">
              이용약관 보기 →
            </Link>
          </div>
        </section>
      </div>

      {feedbackOpen && (
        <div
          onClick={() => !feedbackSubmitting && setFeedbackOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 text-white"
          >
            <h3 className="text-base font-bold mb-4">💬 의견 보내기</h3>

            <div className="text-xs text-white/50 mb-2">분류</div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {([
                ["bug", "🐛 버그"],
                ["feature", "💡 기능요청"],
                ["complaint", "😤 불편사항"],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFeedbackCategory(val)}
                  className={
                    "rounded-lg border px-3 py-2 text-xs font-medium transition " +
                    (feedbackCategory === val
                      ? "border-blue-500 bg-blue-500/20 text-blue-200"
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]")
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="text-xs text-white/50 mb-2">내용</div>
            <textarea
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value.slice(0, 2000))}
              placeholder="어떤 점이 불편하셨나요? 자유롭게 작성해주세요."
              rows={6}
              className="w-full rounded-xl bg-white/[0.05] border border-white/10 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 mb-1"
            />
            <p className="text-[10px] text-white/30 mb-4 text-right">{feedbackContent.length}/2000</p>

            <div className="flex gap-2">
              <Button
                onClick={() => setFeedbackOpen(false)}
                disabled={feedbackSubmitting}
                variant="outline"
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={() => void submitFeedback()}
                disabled={feedbackSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {feedbackSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "보내기"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
