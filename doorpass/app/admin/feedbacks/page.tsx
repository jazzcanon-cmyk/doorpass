"use client"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface FeedbackRow {
  id: number
  user_email: string
  user_name: string | null
  category: "bug" | "feature" | "complaint" | "password_error" | "general"
  building_id: number | null
  building_name: string | null
  content: string
  status: "new" | "reading" | "resolved" | "rejected"
  admin_reply: string | null
  replied_at: string | null
  replied_by: string | null
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

export default function AdminFeedbacksPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [newCount, setNewCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"all" | FeedbackRow["status"]>("new")
  const [categoryFilter, setCategoryFilter] = useState<"all" | FeedbackRow["category"]>("all")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [replyDraft, setReplyDraft] = useState<Record<number, string>>({})

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (categoryFilter !== "all") params.set("category", categoryFilter)
    fetch(`/api/admin/feedbacks?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { feedbacks?: FeedbackRow[]; newCount?: number }) => {
        setRows(d.feedbacks ?? [])
        setNewCount(d.newCount ?? 0)
      })
      .catch(() => toast.error("목록을 불러오지 못했어요."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter, categoryFilter])

  const updateFeedback = async (
    id: number,
    update: { status?: FeedbackRow["status"]; admin_reply?: string | null }
  ) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/feedbacks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error || "처리에 실패했어요.")
        return
      }
      toast.success("처리됐어요.")
      load()
    } catch {
      toast.error("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 px-4 py-4">
        <h1 className="text-base font-bold flex items-center gap-2">
          💬 피드백 관리
          {newCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold">
              {newCount}
            </span>
          )}
        </h1>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-1 mx-4 mt-4 bg-white/5 rounded-xl p-1">
        {(["new", "reading", "resolved", "rejected", "all"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={
              "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all " +
              (statusFilter === key ? "bg-blue-500 text-white" : "text-white/50 hover:text-white")
            }
          >
            {key === "all" ? "전체" : STATUS_LABEL[key].split(" ")[1]}
          </button>
        ))}
      </div>

      {/* 분류 필터 */}
      <div className="flex flex-wrap gap-1.5 mx-4 mt-2">
        {(["all", "bug", "feature", "complaint", "password_error", "general"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setCategoryFilter(key)}
            className={
              "px-2.5 py-1 text-[11px] rounded-full border transition-all " +
              (categoryFilter === key
                ? "bg-blue-500/20 border-blue-400 text-blue-200"
                : "border-white/10 text-white/50 hover:bg-white/5")
            }
          >
            {key === "all" ? "전체 분류" : CATEGORY_LABEL[key]}
          </button>
        ))}
      </div>

      <div className="px-4 mt-4 pb-8 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-white/30 text-sm">로딩 중...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm">해당 조건의 피드백이 없습니다.</div>
        ) : (
          rows.map((fb) => {
            const created = new Date(fb.created_at).toLocaleString("ko-KR")
            const replied = fb.replied_at ? new Date(fb.replied_at).toLocaleString("ko-KR") : null
            const reply = replyDraft[fb.id] ?? ""
            return (
              <div key={fb.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-medium text-white/80">{CATEGORY_LABEL[fb.category]}</span>
                      <span className="text-xs text-white/40">·</span>
                      <span className="text-xs font-medium text-white truncate">{fb.user_name ?? "(이름 없음)"}</span>
                      <span className="text-xs text-white/40 truncate">({fb.user_email})</span>
                    </div>
                    {fb.building_name && (
                      <div className="text-[11px] text-amber-300 mb-1">🏢 {fb.building_name}</div>
                    )}
                    <p className="text-sm text-white/90 whitespace-pre-wrap mb-1">{fb.content}</p>
                    <p className="text-[11px] text-white/40">{created}</p>
                  </div>
                  <span className={
                    "text-xs font-medium whitespace-nowrap " +
                    (fb.status === "new" ? "text-amber-400"
                     : fb.status === "reading" ? "text-blue-400"
                     : fb.status === "resolved" ? "text-emerald-400"
                     : "text-red-400")
                  }>
                    {STATUS_LABEL[fb.status]}
                  </span>
                </div>

                {fb.admin_reply && (
                  <div className="mt-2 rounded-md bg-blue-500/10 border border-blue-500/20 p-2.5 text-xs text-blue-200">
                    <p className="font-semibold mb-0.5">관리자 답변</p>
                    <p className="whitespace-pre-wrap">{fb.admin_reply}</p>
                    {replied && <p className="text-[10px] text-blue-300/60 mt-1">{replied} · {fb.replied_by}</p>}
                  </div>
                )}

                {fb.status !== "resolved" && fb.status !== "rejected" && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReplyDraft({ ...replyDraft, [fb.id]: e.target.value.slice(0, 1000) })}
                      placeholder="답변 (선택) — 답변 작성 후 [확인중] 또는 [해결]을 누르면 함께 저장됩니다."
                      rows={2}
                      className="w-full rounded-lg bg-white/[0.05] border border-white/10 p-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/40"
                    />
                    <div className="flex gap-2 flex-wrap">
                      {fb.status === "new" && (
                        <button
                          onClick={() => void updateFeedback(fb.id, { status: "reading", admin_reply: reply || undefined })}
                          disabled={busyId === fb.id}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold disabled:opacity-50"
                        >
                          확인중
                        </button>
                      )}
                      <button
                        onClick={() => void updateFeedback(fb.id, { status: "resolved", admin_reply: reply || undefined })}
                        disabled={busyId === fb.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold disabled:opacity-50"
                      >
                        해결
                      </button>
                      <button
                        onClick={() => void updateFeedback(fb.id, { status: "rejected", admin_reply: reply || undefined })}
                        disabled={busyId === fb.id}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs font-medium disabled:opacity-50"
                      >
                        반려
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
