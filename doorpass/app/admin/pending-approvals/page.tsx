"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, XCircle, Clock, UserCheck, HelpCircle, Loader2, Building2 } from "lucide-react"

interface Branch {
  id: string
  name: string
  region: string
}

interface Approval {
  id: number
  user_email: string
  user_name: string
  selected_branch_id: string
  requested_at: string
  reason?: string | null
  branches?: { name?: string; region?: string } | null
}

type FilterType = "all" | "etc"
type Role = "driver" | "editor"

export default function PendingApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>("all")
  const [approveModal, setApproveModal] = useState<Approval | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role>("driver")
  const [selectedBranchOverride, setSelectedBranchOverride] = useState("")
  const [branches, setBranches] = useState<Branch[]>([])
  const [processing, setProcessing] = useState(false)

  const fetchApprovals = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/pending-approvals")
      const data = await res.json().catch(() => ({}))
      setApprovals(data.approvals || [])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void fetchApprovals() }, [])

  useEffect(() => {
    if (!approveModal) return
    void fetch("/api/branches")
      .then((r) => r.json())
      .then((d) => setBranches(Array.isArray(d.branches) ? d.branches : []))
      .catch(() => setBranches([]))
  }, [approveModal])

  const openApprove = (a: Approval) => {
    setSelectedRole("driver")
    setSelectedBranchOverride("")
    setApproveModal(a)
  }

  const handleApprove = async () => {
    if (!approveModal) return
    setProcessing(true)
    try {
      const body: Record<string, unknown> = {
        approvalId: approveModal.id,
        action: "approve",
        role: selectedRole,
      }
      // 기타 선택 시 branch override 전달 (빈 문자열이면 null)
      if (approveModal.selected_branch_id === "etc-branch") {
        body.branch_id_override = selectedBranchOverride || null
      }
      const res = await fetch("/api/admin/approve-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        alert(data?.error || "이미 처리된 승인 요청입니다. 화면을 새로고침해주세요.")
        setApproveModal(null)
        await fetchApprovals()
        return
      }
      if (!res.ok) {
        alert(data?.error || "처리 중 오류가 발생했습니다")
        return
      }
      setApproveModal(null)
      await fetchApprovals()
    } catch {
      alert("처리 중 오류가 발생했습니다")
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (approvalId: number) => {
    if (!confirm("거부하시겠습니까?")) return
    try {
      const res = await fetch("/api/admin/approve-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId, action: "reject" }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        alert(data?.error || "이미 처리된 승인 요청입니다. 화면을 새로고침해주세요.")
        await fetchApprovals()
        return
      }
      if (!res.ok) {
        alert(data?.error || "처리 중 오류가 발생했습니다")
        return
      }
      await fetchApprovals()
    } catch {
      alert("처리 중 오류가 발생했습니다")
    }
  }

  const filtered = filter === "etc"
    ? approvals.filter((a) => a.selected_branch_id === "etc-branch")
    : approvals

  const etcCount = approvals.filter((a) => a.selected_branch_id === "etc-branch").length
  const isEtcApproval = approveModal?.selected_branch_id === "etc-branch"
  const branchOnly = branches.filter((b) => (b as Branch & { type?: string }).type === "branch" || !(b as Branch & { type?: string }).type)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">승인 대기 목록</h1>
        <p className="text-white/40 text-sm mt-1">{approvals.length}건의 승인 요청</p>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl w-fit">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === "all" ? "bg-blue-600 text-white shadow" : "text-white/50 hover:text-white/80"}`}
        >
          전체 {approvals.length > 0 && `(${approvals.length})`}
        </button>
        <button
          onClick={() => setFilter("etc")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === "etc" ? "bg-amber-600 text-white shadow" : "text-white/50 hover:text-white/80"}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          기타 {etcCount > 0 && `(${etcCount})`}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
          승인 대기 중인 요청이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((approval) => {
            const isEtc = approval.selected_branch_id === "etc-branch"
            return (
              <div
                key={approval.id}
                className={`rounded-2xl border p-5 ${isEtc ? "bg-amber-500/5 border-amber-500/20" : "bg-white/[0.03] border-white/[0.08]"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Clock className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                      <span className="font-semibold text-white">{approval.user_name || approval.user_email}</span>
                      {isEtc && (
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
                          <HelpCircle className="h-3 w-3" /> 기타
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-white/50">
                      <p>📧 {approval.user_email}</p>
                      <p className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {isEtc ? "기타 (소속 대리점 없음)" : (approval.branches?.name ?? approval.selected_branch_id)}
                        {!isEtc && approval.branches?.region && ` · ${approval.branches.region}`}
                      </p>
                      {isEtc && approval.reason && (
                        <p className="text-amber-300/80">💬 사유: {approval.reason}</p>
                      )}
                      <p>📅 {new Date(approval.requested_at).toLocaleString("ko-KR")}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openApprove(approval)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/25 transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4" /> 승인
                    </button>
                    <button
                      onClick={() => void handleReject(approval.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                    >
                      <XCircle className="h-4 w-4" /> 거부
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 승인 모달 */}
      {approveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setApproveModal(null) }}
        >
          <div className="w-full max-w-sm bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 space-y-5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-400" />
              승인 처리
            </h3>
            <div className="text-sm text-white/60">
              <p className="font-medium text-white">{approveModal.user_name || approveModal.user_email}</p>
              {isEtcApproval && approveModal.reason && (
                <p className="mt-1 text-amber-300/80 text-xs">사유: {approveModal.reason}</p>
              )}
            </div>

            {/* 역할 선택 */}
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">역할 선택</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedRole("driver")}
                  className={`rounded-xl border-2 p-3 text-center transition-colors ${selectedRole === "driver" ? "border-blue-500 bg-blue-500/20" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                >
                  <div className="text-xl mb-1">🚗</div>
                  <div className="text-sm font-semibold text-white">기사</div>
                  <div className="text-[11px] text-white/40">비번 열람만</div>
                </button>
                <button
                  onClick={() => setSelectedRole("editor")}
                  className={`rounded-xl border-2 p-3 text-center transition-colors ${selectedRole === "editor" ? "border-blue-500 bg-blue-500/20" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                >
                  <div className="text-xl mb-1">✏️</div>
                  <div className="text-sm font-semibold text-white">편집자</div>
                  <div className="text-[11px] text-white/40">열람 + 수정</div>
                </button>
              </div>
            </div>

            {/* 기타인 경우: 대리점 배정 (선택) */}
            {isEtcApproval && (
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                  대리점 배정 <span className="normal-case text-white/30">(선택)</span>
                </p>
                <select
                  value={selectedBranchOverride}
                  onChange={(e) => setSelectedBranchOverride(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">배정 안 함 (기타 유지)</option>
                  {branchOnly.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.region})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setApproveModal(null)}
                className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5"
                disabled={processing}
              >
                취소
              </button>
              <button
                onClick={() => void handleApprove()}
                disabled={processing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white"
              >
                {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                승인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
