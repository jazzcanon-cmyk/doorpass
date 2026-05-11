"use client"
import { useEffect, useState } from "react"
import { X, Loader2, Phone, Trash2, Star } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { RatingForm } from "@/components/RatingForm"
import {
  type DeliveryRequest,
  type DeliveryApplication,
  VOLUME_LABEL,
  PAY_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_COLOR,
} from "@/types/delivery"

type MyRating = { rating: number; comment: string | null } | null

interface Props {
  open: boolean
  requestId: number | string | null
  currentEmail?: string
  onClose: () => void
  onChanged: () => void
}

export function DeliveryDetailModal({ open, requestId, currentEmail, onClose, onChanged }: Props) {
  const [loading, setLoading] = useState(true)
  const [request, setRequest] = useState<DeliveryRequest | null>(null)
  const [applications, setApplications] = useState<DeliveryApplication[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [actingId, setActingId] = useState<string | number | null>(null)
  const [completing, setCompleting] = useState(false)
  const [myRating, setMyRating] = useState<MyRating>(null)

  useEffect(() => {
    if (!open || requestId == null) return
    setLoading(true)
    fetch(`/api/delivery/${requestId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          toast.error("정보를 불러오지 못했습니다.")
          onClose()
          return
        }
        setRequest(d.request as DeliveryRequest)
        setApplications((d.applications ?? []) as DeliveryApplication[])
        setIsOwner(Boolean(d.isOwner))
        setMyRating((d.myRating as MyRating) ?? null)
      })
      .catch(() => toast.error("불러오기 실패"))
      .finally(() => setLoading(false))
  }, [open, requestId, onClose])

  if (!open || requestId == null) return null

  const handleAction = async (applicationId: string | number, action: "accept" | "reject") => {
    setActingId(applicationId)
    try {
      const res = await fetch(`/api/delivery/${requestId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        toast.error(data?.error || "이미 다른 기사님이 수락한 요청입니다.")
        onChanged()
        const r2 = await fetch(`/api/delivery/${requestId}`).then((x) => x.json())
        setRequest(r2.request)
        setApplications(r2.applications ?? [])
        return
      }
      if (!res.ok) {
        toast.error(data?.error || "처리 실패")
        return
      }
      toast.success(action === "accept" ? "수락 완료 — 매칭되었습니다" : "거부 처리됨")
      onChanged()
      const r2 = await fetch(`/api/delivery/${requestId}`).then((x) => x.json())
      setRequest(r2.request)
      setApplications(r2.applications ?? [])
    } catch {
      toast.error("처리 실패")
    } finally {
      setActingId(null)
    }
  }

  const handleComplete = async () => {
    if (!confirm("거래를 완료 처리하시겠습니까? 완료 후 평점 입력이 가능합니다.")) return
    setCompleting(true)
    try {
      const res = await fetch(`/api/delivery/${requestId}/complete`, { method: "PATCH" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || "처리 실패")
        return
      }
      toast.success("거래완료 처리되었습니다.")
      onChanged()
      const r2 = await fetch(`/api/delivery/${requestId}`).then((x) => x.json())
      setRequest(r2.request)
      setApplications(r2.applications ?? [])
      setMyRating(r2.myRating ?? null)
    } catch {
      toast.error("처리 실패")
    } finally {
      setCompleting(false)
    }
  }

  const handleRatingSuccess = async () => {
    const r2 = await fetch(`/api/delivery/${requestId}`).then((x) => x.json()).catch(() => null)
    if (r2) setMyRating(r2.myRating ?? null)
  }

  const handleDelete = async () => {
    if (!confirm("이 대체배송 요청을 삭제하시겠습니까?")) return
    const res = await fetch(`/api/delivery/${requestId}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("삭제 실패")
      return
    }
    toast.success("삭제됨")
    onChanged()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">대체배송 상세</h2>
          <div className="flex items-center gap-1">
            {isOwner && (
              <button
                onClick={handleDelete}
                title="삭제"
                className="text-white/40 hover:text-red-400 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="text-white/60 hover:text-white p-1">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading || !request ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-[11px] rounded-md border ${STATUS_COLOR[request.status]}`}>
                {STATUS_LABEL[request.status]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-white/50">대리점</div>
              <div className="text-white">{request.branch_name ?? "-"}</div>
              <div className="text-white/50">날짜</div>
              <div className="text-white">{request.request_date}</div>
              <div className="text-white/50">물량</div>
              <div className="text-white">{VOLUME_LABEL[request.volume]}</div>
              <div className="text-white/50">단가</div>
              <div className="text-white">
                {PAY_TYPE_LABEL[request.pay_type]}
                {request.pay_amount ? ` ${request.pay_amount.toLocaleString()}원` : ""}
              </div>
              <div className="text-white/50">구역</div>
              <div className="text-white">{request.area || "-"}</div>
              <div className="text-white/50">요청자</div>
              <div className="text-white">{request.requester_name || request.requester_email}</div>
            </div>

            {request.memo && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="text-[11px] text-white/40 mb-1">메모</div>
                <div className="text-sm text-white/90 whitespace-pre-wrap">{request.memo}</div>
              </div>
            )}

            {request.contact && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-300" />
                <a href={`tel:${request.contact}`} className="text-emerald-200 font-medium">
                  {request.contact}
                </a>
              </div>
            )}

            {isOwner && (
              <div>
                <div className="text-xs font-medium text-white/70 mb-2">
                  신청자 ({applications.length}명)
                </div>
                {applications.length === 0 ? (
                  <div className="text-center text-sm text-white/40 py-6 border border-dashed border-white/10 rounded-lg">
                    아직 신청자가 없습니다
                  </div>
                ) : (
                  <div className="space-y-2">
                    {applications.map((a) => (
                      <div
                        key={a.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-white font-medium">
                            {a.applicant_name || a.applicant_email}
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              a.status === "accepted"
                                ? "bg-blue-500/20 text-blue-200"
                                : a.status === "rejected"
                                ? "bg-white/5 text-white/40"
                                : "bg-emerald-500/20 text-emerald-200"
                            }`}
                          >
                            {a.status === "accepted"
                              ? "수락됨"
                              : a.status === "rejected"
                              ? "거부됨"
                              : "대기"}
                          </span>
                        </div>
                        {a.message && (
                          <div className="text-xs text-white/70 whitespace-pre-wrap">{a.message}</div>
                        )}
                        {a.status === "pending" && request.status === "open" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAction(a.id, "accept")}
                              disabled={actingId === a.id}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                            >
                              수락
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction(a.id, "reject")}
                              disabled={actingId === a.id}
                              className="flex-1 h-8 text-xs text-white/70 hover:text-white border border-white/10"
                            >
                              거부
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isOwner && applications[0] && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="text-[11px] text-white/40 mb-1">내 신청 상태</div>
                <div className="text-sm text-white">
                  {applications[0].status === "accepted"
                    ? "✅ 수락됨 — 위 연락처로 연락하세요"
                    : applications[0].status === "rejected"
                    ? "❌ 거부됨"
                    : "⏳ 대기 중"}
                </div>
              </div>
            )}

            {/* 거래완료 버튼 — 의뢰자 + matched 상태 */}
            {isOwner && request.status === "matched" && (
              <Button
                onClick={handleComplete}
                disabled={completing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {completing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  "✅ 거래완료"
                )}
              </Button>
            )}

            {/* 거래완료 배지 + 완료 시각 */}
            {request.status === "closed" && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-emerald-300 text-sm font-medium">✅ 거래완료</span>
                {request.completed_at && (
                  <span className="text-white/40 text-xs ml-auto">
                    {new Date(request.completed_at).toLocaleDateString("ko-KR", {
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            )}

            {/* 평점 입력 영역 — closed + 당사자 */}
            {request.status === "closed" &&
              (isOwner || request.matched_email === currentEmail) && (
                <div className="border-t border-white/10 pt-4">
                  <div className="text-xs font-medium text-white/70 mb-3">
                    {isOwner ? "매칭 기사님 평점" : "의뢰자 평점"}
                  </div>
                  {myRating ? (
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2.5">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-4 w-4 ${
                              n <= myRating.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-transparent text-white/20"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-yellow-300 font-medium">
                        {myRating.rating}점 등록 완료
                      </span>
                    </div>
                  ) : (
                    <RatingForm
                      ratedEmail={
                        isOwner
                          ? (request.matched_email ?? "")
                          : request.requester_email
                      }
                      deliveryRequestId={request.id as number}
                      onSuccess={handleRatingSuccess}
                    />
                  )}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  )
}
