"use client"
import { useEffect, useState, useCallback } from "react"
import { Loader2, ShieldCheck, ShieldX, Clock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

type Status = "pending" | "approved" | "rejected"

interface RoleRequest {
  id: string
  user_email: string
  user_name: string | null
  requested_role: string
  reason: string | null
  status: Status
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

const TABS: { key: Status; label: string }[] = [
  { key: "pending", label: "대기 중" },
  { key: "approved", label: "승인됨" },
  { key: "rejected", label: "거부됨" },
]

export default function AdminRoleRequestsPage() {
  const [filter, setFilter] = useState<Status>("pending")
  const [requests, setRequests] = useState<RoleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async (status: Status) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/role-requests?status=${status}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error("목록을 불러오지 못했습니다.")
        setRequests([])
        return
      }
      setRequests((data.requests as RoleRequest[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(filter) }, [filter, load])

  const act = async (id: string, action: "approve" | "reject") => {
    if (!confirm(`정말 ${action === "approve" ? "승인" : "거부"}하시겠습니까?`)) return
    setActingId(id)
    try {
      const res = await fetch(`/api/admin/role-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error("처리 실패")
        return
      }
      toast.success(action === "approve" ? "승인되었습니다." : "거부되었습니다.")
      void load(filter)
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">권한 요청 관리</h1>

      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === t.key
                ? "bg-blue-600 text-white shadow"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-white/30 text-center py-10 rounded-xl border border-dashed border-white/10">
          요청이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{r.user_name ?? "(이름 없음)"}</p>
                  <p className="text-xs text-white/50 truncate">{r.user_email}</p>
                </div>
                <span className="text-[11px] text-white/30 flex-shrink-0">
                  {new Date(r.created_at).toLocaleString("ko-KR")}
                </span>
              </div>

              {r.reason && (
                <p className="text-sm text-white/70 bg-white/[0.04] rounded-lg p-3 whitespace-pre-wrap">
                  {r.reason}
                </p>
              )}

              {filter === "pending" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void act(r.id, "approve")}
                    disabled={actingId === r.id}
                    className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                  >
                    {actingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    승인
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void act(r.id, "reject")}
                    disabled={actingId === r.id}
                    className="gap-1.5"
                  >
                    <ShieldX className="h-3.5 w-3.5" />
                    거부
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-white/40 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  처리자: {r.reviewed_by ?? "-"}
                  {r.reviewed_at && ` · ${new Date(r.reviewed_at).toLocaleString("ko-KR")}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
