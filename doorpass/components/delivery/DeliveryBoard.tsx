"use client"
import { useEffect, useMemo, useState, useCallback } from "react"
import { Plus, Loader2, Truck, Eye, Calendar, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { DeliveryRequestModal } from "./DeliveryRequestModal"
import { DeliveryApplyModal } from "./DeliveryApplyModal"
import { DeliveryDetailModal } from "./DeliveryDetailModal"
import {
  type DeliveryRequest,
  VOLUME_LABEL,
  PRICE_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_COLOR,
  type DeliveryStatus,
} from "@/types/delivery"

function ago(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return "방금 전"
  if (s < 3600) return Math.floor(s / 60) + "분 전"
  if (s < 86400) return Math.floor(s / 3600) + "시간 전"
  return Math.floor(s / 86400) + "일 전"
}

interface Props {
  currentEmail?: string
  branchId?: string | null
}

type Tab = "all" | "mine" | "applied"

export function DeliveryBoard({ currentEmail, branchId }: Props) {
  const [tab, setTab] = useState<Tab>("all")
  const [statusFilter, setStatusFilter] = useState<"" | DeliveryStatus>("")
  const [dateFilter, setDateFilter] = useState("")
  const [requests, setRequests] = useState<DeliveryRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [applyTarget, setApplyTarget] = useState<DeliveryRequest | null>(null)
  const [detailId, setDetailId] = useState<string | number | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (tab === "mine") params.set("mine", "1")
    if (tab === "applied") params.set("applied", "1")
    if (statusFilter) params.set("status", statusFilter)
    if (dateFilter) params.set("date", dateFilter)
    try {
      const res = await fetch(`/api/delivery?${params.toString()}`)
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
        return
      }
      setRequests(data.requests ?? [])
    } catch {
      toast.error("불러오기 실패")
    } finally {
      setLoading(false)
    }
  }, [tab, statusFilter, dateFilter])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "mine", label: "내 요청" },
    { key: "applied", label: "내 신청" },
  ]

  const handleApply = (r: DeliveryRequest) => {
    if (r.user_email === currentEmail) {
      toast.error("본인 요청에는 신청할 수 없습니다")
      return
    }
    if (r.my_application_status) {
      toast.message("이미 신청했습니다")
      return
    }
    if (r.status !== "open") {
      toast.message("이미 마감된 요청입니다")
      return
    }
    setApplyTarget(r)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Truck className="h-4 w-4 text-blue-400" /> 대리배송
        </h2>
        <Button
          size="sm"
          onClick={() => setRequestModalOpen(true)}
          className="gap-1.5 h-8 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          요청하기
        </Button>
      </div>

      <div className="flex gap-1 mb-3 rounded-xl bg-white/5 border border-white/10 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              tab === t.key
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | DeliveryStatus)}
          className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white"
        >
          <option value="">전체 상태</option>
          <option value="open">모집중</option>
          <option value="matched">매칭완료</option>
          <option value="closed">마감</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white"
        />
        {(statusFilter || dateFilter) && (
          <button
            onClick={() => {
              setStatusFilter("")
              setDateFilter("")
            }}
            className="text-xs text-white/50 hover:text-white px-2 py-1.5"
          >
            초기화
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center py-12">
            <Truck className="h-12 w-12 text-white/20" />
            <p className="mt-4 text-white/50 text-sm text-center">
              {tab === "mine"
                ? "내가 요청한 대리배송이 없습니다"
                : tab === "applied"
                ? "내가 신청한 대리배송이 없습니다"
                : "대리배송 요청이 없습니다"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <DeliveryCard
              key={r.id}
              request={r}
              currentEmail={currentEmail}
              onApply={() => handleApply(r)}
              onOpen={() => setDetailId(r.id)}
            />
          ))}
        </div>
      )}

      <DeliveryRequestModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        onCreated={fetchList}
        branchId={branchId ?? null}
      />

      <DeliveryApplyModal
        open={applyTarget !== null}
        requestId={applyTarget?.id ?? null}
        onClose={() => setApplyTarget(null)}
        onApplied={fetchList}
      />

      <DeliveryDetailModal
        open={detailId !== null}
        requestId={detailId}
        currentEmail={currentEmail}
        onClose={() => setDetailId(null)}
        onChanged={fetchList}
      />
    </div>
  )
}

function DeliveryCard({
  request,
  currentEmail,
  onApply,
  onOpen,
}: {
  request: DeliveryRequest
  currentEmail?: string
  onApply: () => void
  onOpen: () => void
}) {
  const isMine = request.user_email === currentEmail
  const applied = !!request.my_application_status
  const priceLabel = useMemo(() => {
    const t = PRICE_TYPE_LABEL[request.price_type]
    if (request.price_type === "negotiable") return t
    return request.price_amount ? `${t} ${request.price_amount.toLocaleString()}원` : t
  }, [request.price_type, request.price_amount])

  return (
    <Card className="bg-white/5 border-white/10 hover:border-blue-500/40 transition-all">
      <CardContent className="p-3.5">
        <button onClick={onOpen} className="text-left w-full">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 text-[10px] rounded border ${STATUS_COLOR[request.status]}`}>
                {STATUS_LABEL[request.status]}
              </span>
              {isMine && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  내 요청
                </span>
              )}
              {applied && !isMine && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  {request.my_application_status === "accepted"
                    ? "수락됨"
                    : request.my_application_status === "rejected"
                    ? "거부됨"
                    : "신청 완료"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <span className="flex items-center gap-0.5">
                <Eye className="h-3 w-3" /> {request.view_count ?? 0}
              </span>
              <span>{ago(request.created_at)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-sm font-semibold text-white mb-1">
            <MapPin className="h-3.5 w-3.5 text-blue-400" />
            {request.branch_name ?? "지점 미지정"}
            <span className="text-white/40 text-xs font-normal flex items-center gap-1 ml-auto">
              <Calendar className="h-3 w-3" /> {request.delivery_date}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 text-xs text-white/70 mb-2">
            <div>📦 {VOLUME_LABEL[request.volume]}</div>
            <div>💰 {priceLabel}</div>
          </div>

          {request.area_description && (
            <div className="text-xs text-white/60 line-clamp-1 mb-1">{request.area_description}</div>
          )}
          {typeof request.application_count === "number" && (
            <div className="text-[11px] text-white/40">신청자 {request.application_count}명</div>
          )}
        </button>

        {!isMine && request.status === "open" && (
          <Button
            size="sm"
            onClick={onApply}
            disabled={applied}
            className={`w-full h-8 mt-2 text-xs ${
              applied
                ? "bg-white/10 text-white/40"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {applied ? "신청 완료" : "신청하기"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
